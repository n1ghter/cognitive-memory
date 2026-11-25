import fs from 'node:fs';
import path from 'node:path';
import { EmbeddingCache } from '../cache.js';
import { DatabaseManager } from '../db.js';
import { getEmbeddingProvider, isEmbeddingDimensionError } from '../retrieval.js';

interface ImportArgs {
  vaultPath?: string;
  /** When true, re-imports all Markdown files regardless of mtime (used by reindex). */
  force?: boolean;
}

interface ParsedMemory {
  id: string | null;
  category: string;
  importance: number;
  text: string;
  metadata: any;
  valid_from?: string | null;
  valid_until?: string | null;
  superseded_by?: string | null;
  is_active: number;
  relations: Array<{
    type: string;
    target: string;
    direction: 'out' | 'in';
    is_external?: boolean;
  }>;
}

export async function executeMemoryImport(args: ImportArgs = {}): Promise<{
  success: true;
  imported_files: string[];
  total_imported: number;
  errors: string[];
}> {
  const exportDir = args.vaultPath
    ? path.resolve(args.vaultPath)
    : path.join(process.cwd(), 'memories_export');

  if (!fs.existsSync(exportDir)) {
    return { success: true, imported_files: [], total_imported: 0, errors: [] };
  }

  const db = DatabaseManager.getInstance();
  const files = fs.readdirSync(exportDir).filter((f) => f.endsWith('.md'));

  const importedFiles: string[] = [];
  const errors: string[] = [];
  let totalImported = 0;

  const validIdsOnDisk = new Set<string>();
  const parsedFiles: Array<{
    file: string;
    filePath: string;
    mtimeMs: number;
    parsed: ParsedMemory;
    fullId: string;
  }> = [];

  // Phase 1: Parse and collect all valid IDs
  for (const file of files) {
    try {
      const filePath = path.join(exportDir, file);
      const stat = fs.statSync(filePath);
      const mtimeMs = stat.mtimeMs;

      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseMarkdownMemory(content);

      let shortId = parsed?.id;
      if (!shortId) {
        // Fallback to filename parsing
        const idMatch = file.match(/^Memory_(.+)\.md$/);
        if (idMatch) shortId = idMatch[1];
      }

      if (!shortId || !parsed) continue;

      const fullId = shortId.includes(':') ? shortId : `memory:${shortId}`;
      validIdsOnDisk.add(fullId);
      validIdsOnDisk.add(shortId);

      const row = db
        .prepare('SELECT id, updated_at, is_active FROM memory WHERE id = ? OR id = ?')
        .get(shortId, fullId) as { id: string; updated_at: string; is_active: number } | undefined;

      if (row?.id) {
        validIdsOnDisk.add(row.id);
      }

      let dbUpdatedMs = 0;
      if (row?.updated_at) {
        dbUpdatedMs = new Date(`${row.updated_at.replace(' ', 'T')}Z`).getTime();
      }

      if (!args.force && row && mtimeMs <= dbUpdatedMs + 2000) {
        if (row.is_active === 0) {
          // The agent deleted this memory, and the user hasn't modified the file.
          // Delete the lingering file to reflect the agent's deletion in Obsidian.
          fs.unlinkSync(filePath);
          validIdsOnDisk.delete(fullId);
          validIdsOnDisk.delete(shortId);
          validIdsOnDisk.delete(row.id);
        }
        continue;
      }

      parsedFiles.push({ file, filePath, mtimeMs, parsed, fullId: row ? row.id : fullId });
    } catch (err: any) {
      errors.push(`Error processing ${file}: ${err.message}`);
    }
  }

  // Deletion Handling via Sync State (skipped during full force reindex)
  const syncStatePath = path.join(exportDir, '.sync_state.json');
  if (!args.force && fs.existsSync(syncStatePath)) {
    try {
      const syncState = JSON.parse(fs.readFileSync(syncStatePath, 'utf-8'));
      if (Array.isArray(syncState.exported_ids)) {
        const exportedLastTime = new Set<string>(syncState.exported_ids);
        for (const previouslyExportedId of exportedLastTime) {
          if (!validIdsOnDisk.has(previouslyExportedId)) {
            // File was exported but is no longer on disk -> User deleted it!
            db.prepare('UPDATE memory SET is_active = 0 WHERE id = ?').run(previouslyExportedId);
          }
        }
      }
    } catch (_e) {
      errors.push('Failed to process .sync_state.json for deletions');
    }
  }

  // Phase 2: Upsert nodes and optionally fetch embeddings (zero-Ollama resilient)
  const provider = getEmbeddingProvider();
  for (const { file, mtimeMs, parsed, fullId } of parsedFiles) {
    try {
      const rowExists = db.prepare('SELECT 1 FROM memory WHERE id = ?').get(fullId);

      const importTx = db.transaction(() => {
        const timestamp = new Date(mtimeMs).toISOString().replace('T', ' ').replace('Z', '');
        const validFrom = parsed.valid_from || timestamp;
        if (rowExists) {
          db.prepare(
            `UPDATE memory
             SET text = ?, metadata = ?, importance = ?, updated_at = ?, is_active = ?,
                 valid_from = COALESCE(valid_from, ?), valid_until = ?, superseded_by = ?
             WHERE id = ?`
          ).run(
            parsed.text,
            JSON.stringify(parsed.metadata),
            parsed.importance,
            timestamp,
            parsed.is_active,
            validFrom,
            parsed.valid_until ?? null,
            parsed.superseded_by ?? null,
            fullId
          );
        } else {
          const stmt = db.prepare(`
            INSERT INTO memory (
              id, text, metadata, importance, is_active,
              created_at, updated_at, last_accessed_at, accessed_count,
              valid_from, valid_until, superseded_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
          `);
          stmt.run(
            fullId,
            parsed.text,
            JSON.stringify(parsed.metadata),
            parsed.importance,
            parsed.is_active,
            timestamp,
            timestamp,
            timestamp,
            validFrom,
            parsed.valid_until ?? null,
            parsed.superseded_by ?? null
          );
        }
        const ftsRow = db.prepare('SELECT rowid FROM memory WHERE id = ?').get(fullId) as
          | { rowid: number | bigint }
          | undefined;
        if (ftsRow) {
          DatabaseManager.syncFtsRow('main', ftsRow.rowid, parsed.text, parsed.metadata, db);
        }
      });
      importTx();

      if (parsed.text.trim() && provider !== 'none') {
        try {
          const embedding = await EmbeddingCache.getEmbedding(parsed.text);
          const rowidRow = db.prepare('SELECT rowid FROM memory WHERE id = ?').get(fullId) as {
            rowid: bigint;
          };
          if (rowidRow) {
            const rowid = BigInt(rowidRow.rowid);
            const floatArray = new Float32Array(embedding);
            const vecTx = db.transaction(() => {
              db.prepare('DELETE FROM main.vec_memory WHERE rowid = ?').run(rowid);
              db.prepare('INSERT INTO main.vec_memory (rowid, embedding) VALUES (?, ?)').run(
                rowid,
                floatArray
              );
            });
            vecTx();
          }
        } catch (embErr) {
          if (isEmbeddingDimensionError(embErr) || provider === 'ollama') {
            throw embErr;
          }
          console.error(
            `[Import] Embedding provider unavailable for ${file}; indexed in lexical FTS5 mode.`
          );
        }
      }

      importedFiles.push(file);
      totalImported++;
    } catch (err: any) {
      errors.push(`Error inserting node ${file}: ${err.message}`);
    }
  }

  // Phase 3: Rebuild edges (now all nodes are guaranteed to be in the DB)
  for (const { parsed, fullId, file } of parsedFiles) {
    try {
      const edgeTx = db.transaction(() => {
        db.prepare('DELETE FROM edges WHERE source_id = ? OR target_id = ?').run(fullId, fullId);
        for (const rel of parsed.relations) {
          const isOut = rel.direction === 'out';
          const isExternal =
            Boolean(rel.is_external) ||
            rel.target.startsWith('obsidian://') ||
            rel.target.startsWith('vault://');

          if (isExternal && isOut) {
            db.prepare(`
              INSERT OR IGNORE INTO memory (id, text, metadata, importance, is_active, created_at, updated_at, last_accessed_at, accessed_count)
              VALUES (?, ?, ?, 0.0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
            `).run(rel.target, rel.target, JSON.stringify({ is_external: true, uri: rel.target }));
            const relId = `edge:${fullId}:${rel.target}:${rel.type}`;
            db.prepare(`
              INSERT OR REPLACE INTO edges (id, source_id, target_id, relation_type, is_external)
              VALUES (?, ?, ?, ?, 1)
            `).run(relId, fullId, rel.target, rel.type);
            continue;
          }

          const targetFullId = rel.target.includes(':') ? rel.target : `memory:${rel.target}`;
          const sourceId = isOut ? fullId : targetFullId;
          const targetId = isOut ? targetFullId : fullId;

          const otherId = isOut ? targetId : sourceId;
          const otherRow = db
            .prepare('SELECT id FROM memory WHERE id = ? OR id = ? LIMIT 1')
            .get(otherId, rel.target) as { id: string } | undefined;
          if (otherRow) {
            const resolvedSource = isOut ? fullId : otherRow.id;
            const resolvedTarget = isOut ? otherRow.id : fullId;
            const relId = `edge:${resolvedSource}:${resolvedTarget}:${rel.type}`;
            db.prepare(`
              INSERT OR REPLACE INTO edges (id, source_id, target_id, relation_type, is_external)
              VALUES (?, ?, ?, ?, 0)
            `).run(relId, resolvedSource, resolvedTarget, rel.type);
          }
        }
      });
      edgeTx();
    } catch (err: any) {
      errors.push(`Error inserting edges for ${file}: ${err.message}`);
    }
  }

  return { success: true, imported_files: importedFiles, total_imported: totalImported, errors };
}

function parseMarkdownMemory(content: string): ParsedMemory | null {
  try {
    const lines = content.split('\n');
    let inFrontmatter = false;
    const frontmatter: Record<string, string> = {};
    const textLines: string[] = [];
    let inText = false;
    let inRelations = false;
    const relations: ParsedMemory['relations'] = [];
    let inDetails = false;
    let inJson = false;
    let jsonString = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '---') {
        if (!inFrontmatter && i === 0) {
          inFrontmatter = true;
          continue;
        } else if (inFrontmatter) {
          inFrontmatter = false;
          continue;
        }
      }

      if (inFrontmatter) {
        const [key, ...valParts] = line.split(':');
        if (key && valParts.length > 0) {
          frontmatter[key.trim()] = valParts.join(':').trim();
        }
        continue;
      }

      if (line.startsWith('> ')) {
        inText = true;
        textLines.push(line.substring(2));
        continue;
      } else if (line === '>') {
        inText = true;
        textLines.push('');
        continue;
      } else if (inText && line.trim() === '') {
        textLines.push('');
      } else if (inText && line.startsWith('## Graph Relations')) {
        inText = false;
        while (textLines.length > 0 && textLines[textLines.length - 1] === '') {
          textLines.pop();
        }
      }

      if (line.startsWith('## Graph Relations')) {
        inRelations = true;
        continue;
      }

      if (inRelations && line.startsWith('<details>')) inRelations = false;

      if (inRelations && line.startsWith('- ')) {
        const outExtMatch = line.match(/- \*\*(.*?)\*\* ➡️ ((?:obsidian|vault):\/\/\S+)/);
        const outMatch =
          line.match(/- \*\*(.*?)\*\* ➡️ \[\[Memory_(.*?)\]\]/) ||
          line.match(/- \*\*(.*?)\*\* ➡️ \[\[(.*?)\]\]/);
        if (outExtMatch) {
          relations.push({
            type: outExtMatch[1],
            target: outExtMatch[2],
            direction: 'out',
            is_external: true,
          });
        } else if (outMatch) {
          relations.push({ type: outMatch[1], target: outMatch[2], direction: 'out' });
        } else {
          const inMatch =
            line.match(/- ⬅️ \*\*(.*?)\*\* by \[\[Memory_(.*?)\]\]/) ||
            line.match(/- ⬅️ \*\*(.*?)\*\* by \[\[(.*?)\]\]/);
          if (inMatch) {
            relations.push({ type: inMatch[1], target: inMatch[2], direction: 'in' });
          }
        }
      }

      if (line.startsWith('<details>')) inDetails = true;
      if (inDetails && line.startsWith('```json')) {
        inJson = true;
        continue;
      }
      if (inJson && line.startsWith('```')) inJson = false;
      if (inJson) jsonString += `${line}\n`;
    }

    let metadata: any = {};
    if (jsonString.trim()) {
      try {
        metadata = JSON.parse(jsonString);
      } catch (_e) {}
    }
    if (frontmatter.profile && !metadata.profile) {
      metadata.profile = frontmatter.profile;
    }

    const validUntil = frontmatter.valid_until || null;
    const supersededBy = frontmatter.superseded_by || null;
    const isSuperseded = frontmatter.status === 'superseded' || Boolean(validUntil);

    return {
      id: frontmatter.id || null,
      category: frontmatter.category || 'semantic',
      importance: parseFloat(frontmatter.importance) || 0.5,
      text: textLines.join('\n').trim(),
      metadata,
      valid_from: frontmatter.valid_from || null,
      valid_until: validUntil,
      superseded_by: supersededBy,
      is_active: isSuperseded ? 0 : 1,
      relations,
    };
  } catch (_e) {
    return null;
  }
}
