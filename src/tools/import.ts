import fs from 'node:fs';
import path from 'node:path';
import { EmbeddingCache } from '../cache.js';
import { DatabaseManager } from '../db.js';

interface ImportArgs {
  vaultPath?: string;
}

interface ParsedMemory {
  id: string | null;
  category: string;
  importance: number;
  text: string;
  metadata: any;
  relations: Array<{ type: string; target: string; direction: 'out' | 'in' }>;
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

      const row = db
        .prepare('SELECT id, updated_at, is_active FROM memory WHERE id = ? OR id = ?')
        .get(shortId, fullId) as { id: string; updated_at: string; is_active: number } | undefined;

      let dbUpdatedMs = 0;
      if (row?.updated_at) {
        dbUpdatedMs = new Date(`${row.updated_at.replace(' ', 'T')}Z`).getTime();
      }

      if (row && mtimeMs <= dbUpdatedMs + 2000) {
        if (row.is_active === 0) {
          // The agent deleted this memory, and the user hasn't modified the file.
          // Delete the lingering file to reflect the agent's deletion in Obsidian.
          fs.unlinkSync(filePath);
          validIdsOnDisk.delete(fullId);
        }
        continue;
      }

      parsedFiles.push({ file, filePath, mtimeMs, parsed, fullId: row ? row.id : fullId });
    } catch (err: any) {
      errors.push(`Error processing ${file}: ${err.message}`);
    }
  }

  // Deletion Handling via Sync State
  const syncStatePath = path.join(exportDir, '.sync_state.json');
  if (fs.existsSync(syncStatePath)) {
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

  // Phase 2: Upsert nodes and fetch embeddings
  for (const { file, mtimeMs, parsed, fullId } of parsedFiles) {
    try {
      const rowExists = db.prepare('SELECT 1 FROM memory WHERE id = ?').get(fullId);

      const importTx = db.transaction(() => {
        const timestamp = new Date(mtimeMs).toISOString().replace('T', ' ').replace('Z', '');
        if (rowExists) {
          db.prepare(
            'UPDATE memory SET text = ?, metadata = ?, importance = ?, updated_at = ?, is_active = 1 WHERE id = ?'
          ).run(parsed.text, JSON.stringify(parsed.metadata), parsed.importance, timestamp, fullId);
        } else {
          const stmt = db.prepare(`
            INSERT INTO memory (id, text, metadata, importance, is_active, created_at, updated_at, last_accessed_at, accessed_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          `);
          stmt.run(
            fullId,
            parsed.text,
            JSON.stringify(parsed.metadata),
            parsed.importance,
            1,
            timestamp,
            timestamp,
            timestamp
          );
        }
      });
      importTx();

      if (parsed.text.trim()) {
        const embedding = await EmbeddingCache.getEmbedding(parsed.text);
        const rowidRow = db.prepare('SELECT rowid FROM memory WHERE id = ?').get(fullId) as {
          rowid: bigint;
        };
        if (rowidRow) {
          const rowid = BigInt(rowidRow.rowid);
          const floatArray = new Float32Array(embedding);
          const vecTx = db.transaction(() => {
            db.prepare('DELETE FROM vec_memory WHERE rowid = ?').run(rowid);
            db.prepare('INSERT INTO vec_memory (rowid, embedding) VALUES (?, ?)').run(
              rowid,
              floatArray
            );
          });
          vecTx();
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
          const targetFullId = rel.target.includes(':') ? rel.target : `memory:${rel.target}`;

          const sourceId = isOut ? fullId : targetFullId;
          const targetId = isOut ? targetFullId : fullId;

          const otherId = isOut ? targetId : sourceId;
          const otherExists = db.prepare('SELECT 1 FROM memory WHERE id = ?').get(otherId);
          if (otherExists) {
            const relId = `edge:${sourceId}:${targetId}:${rel.type}`;
            db.prepare(`
              INSERT OR REPLACE INTO edges (id, source_id, target_id, relation_type)
              VALUES (?, ?, ?, ?)
            `).run(relId, sourceId, targetId, rel.type);
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
    const relations: Array<{ type: string; target: string; direction: 'out' | 'in' }> = [];
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
        const outMatch =
          line.match(/- \*\*(.*?)\*\* ➡️ \[\[Memory_(.*?)\]\]/) ||
          line.match(/- \*\*(.*?)\*\* ➡️ \[\[(.*?)\]\]/);
        if (outMatch) {
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

    let metadata = {};
    if (jsonString.trim()) {
      try {
        metadata = JSON.parse(jsonString);
      } catch (_e) {}
    }

    return {
      id: frontmatter.id || null,
      category: frontmatter.category || 'semantic',
      importance: parseFloat(frontmatter.importance) || 0.5,
      text: textLines.join('\n').trim(),
      metadata,
      relations,
    };
  } catch (_e) {
    return null;
  }
}
