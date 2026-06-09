import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../db.js';
import { EmbeddingCache } from '../cache.js';

interface ImportArgs {
  vaultPath?: string;
}

interface ParsedMemory {
  id: string;
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
  const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.md') && f.startsWith('Memory_'));
  
  const importedFiles: string[] = [];
  const errors: string[] = [];
  let totalImported = 0;

  for (const file of files) {
    try {
      const filePath = path.join(exportDir, file);
      const stat = fs.statSync(filePath);
      const mtimeMs = stat.mtimeMs;

      // Extract ID from filename Memory_uuid.md
      const idMatch = file.match(/^Memory_(.+)\.md$/);
      if (!idMatch) continue;
      
      const shortId = idMatch[1];
      // Try to find the exact ID. The DB might prefix with memory: or might not.
      // We will check by right matching.
      const row = db.prepare('SELECT id, updated_at FROM memory WHERE id = ? OR id = ?').get(shortId, `memory:${shortId}`) as { id: string; updated_at: string } | undefined;
      
      let dbUpdatedMs = 0;
      if (row && row.updated_at) {
        // SQLite CURRENT_TIMESTAMP is YYYY-MM-DD HH:MM:SS in UTC
        dbUpdatedMs = new Date(row.updated_at.replace(' ', 'T') + 'Z').getTime();
      }

      // Allow 2000ms buffer to prevent loops due to JS Date vs File System mtime resolution
      if (row && mtimeMs <= dbUpdatedMs + 2000) {
        // File is not newer than DB
        continue;
      }

      // Parse the markdown file
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseMarkdownMemory(content, shortId);
      if (!parsed) {
        errors.push(`Failed to parse ${file}`);
        continue;
      }

      const fullId = row ? row.id : (shortId.includes(':') ? shortId : `memory:${shortId}`);

      // Transaction to update memory
      const importTx = db.transaction(() => {
        const timestamp = new Date(mtimeMs).toISOString().replace('T', ' ').replace('Z', '');
        
        if (row) {
          // Update
          db.prepare('UPDATE memory SET text = ?, metadata = ?, importance = ?, updated_at = ? WHERE id = ?')
            .run(parsed.text, JSON.stringify(parsed.metadata), parsed.importance, timestamp, fullId);
        } else {
          // Insert
          const stmt = db.prepare(`
            INSERT INTO memory (id, text, metadata, importance, is_active, created_at, updated_at, last_accessed_at, accessed_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          `);
          stmt.run(fullId, parsed.text, JSON.stringify(parsed.metadata), parsed.importance, 1, timestamp, timestamp, timestamp);
        }

        // Rebuild edges for this memory
        db.prepare('DELETE FROM edges WHERE source_id = ? OR target_id = ?').run(fullId, fullId);
        for (const rel of parsed.relations) {
          const isOut = rel.direction === 'out';
          const targetFullId = rel.target.includes(':') ? rel.target : `memory:${rel.target}`;
          
          const sourceId = isOut ? fullId : targetFullId;
          const targetId = isOut ? targetFullId : fullId;
          
          // Only insert edge if the OTHER node exists to avoid FOREIGN KEY constraint failures
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

      importTx();

      // Update vector embedding (do this outside the main transaction to not block DB if Ollama is slow)
      if (parsed.text.trim()) {
        const embedding = await EmbeddingCache.getEmbedding(parsed.text);
        const rowidRow = db.prepare('SELECT rowid FROM memory WHERE id = ?').get(fullId) as { rowid: bigint };
        
        if (rowidRow) {
          const rowid = BigInt(rowidRow.rowid);
          const floatArray = new Float32Array(embedding);
          const vecTx = db.transaction(() => {
            db.prepare('DELETE FROM vec_memory WHERE rowid = ?').run(rowid);
            db.prepare('INSERT INTO vec_memory (rowid, embedding) VALUES (?, ?)').run(rowid, floatArray);
          });
          vecTx();
        }
      }

      importedFiles.push(file);
      totalImported++;
    } catch (err: any) {
      errors.push(`Error processing ${file}: ${err.message}`);
    }
  }

  return {
    success: true,
    imported_files: importedFiles,
    total_imported: totalImported,
    errors
  };
}

function parseMarkdownMemory(content: string, fallbackId: string): ParsedMemory | null {
  try {
    const lines = content.split('\n');
    let inFrontmatter = false;
    let frontmatter: Record<string, string> = {};
    
    let textLines: string[] = [];
    let inText = false;
    
    let inRelations = false;
    const relations: Array<{ type: string; target: string; direction: 'out' | 'in' }> = [];
    
    let inDetails = false;
    let inJson = false;
    let jsonString = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse Frontmatter
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
      
      // Parse Text
      if (line.startsWith('> ')) {
        inText = true;
        textLines.push(line.substring(2));
        continue;
      } else if (line === '>') {
        inText = true;
        textLines.push('');
        continue;
      } else if (inText && line.trim() === '') {
        // Blank line could be part of text or end of it
        textLines.push('');
      } else if (inText && line.startsWith('## Graph Relations')) {
        inText = false;
        // Trim trailing empty lines from text
        while (textLines.length > 0 && textLines[textLines.length - 1] === '') {
          textLines.pop();
        }
      }
      
      // Parse Relations
      if (line.startsWith('## Graph Relations')) {
        inRelations = true;
        continue;
      }
      
      if (inRelations && line.startsWith('<details>')) {
        inRelations = false;
      }
      
      if (inRelations && line.startsWith('- ')) {
        // e.g. - ⬅️ **has_requirement** by [[Memory_uuid]]
        // e.g. - **influences_design** ➡️ [[Memory_uuid]]
        const outMatch = line.match(/- \*\*(.*?)\*\* ➡️ \[\[Memory_(.*?)\]\]/);
        if (outMatch) {
          relations.push({ type: outMatch[1], target: outMatch[2], direction: 'out' });
        } else {
          const inMatch = line.match(/- ⬅️ \*\*(.*?)\*\* by \[\[Memory_(.*?)\]\]/);
          if (inMatch) {
            relations.push({ type: inMatch[1], target: inMatch[2], direction: 'in' });
          }
        }
      }

      // Parse JSON Metadata
      if (line.startsWith('<details>')) {
        inDetails = true;
      }
      if (inDetails && line.startsWith('\`\`\`json')) {
        inJson = true;
        continue;
      }
      if (inJson && line.startsWith('\`\`\`')) {
        inJson = false;
      }
      if (inJson) {
        jsonString += line + '\n';
      }
    }

    let metadata = {};
    if (jsonString.trim()) {
      try {
        metadata = JSON.parse(jsonString);
      } catch (e) {
        // Failed to parse JSON, use empty or best effort
      }
    }

    return {
      id: fallbackId,
      category: frontmatter.category || 'semantic',
      importance: parseFloat(frontmatter.importance) || 0.5,
      text: textLines.join('\n').trim(),
      metadata,
      relations
    };
  } catch (e) {
    return null;
  }
}
