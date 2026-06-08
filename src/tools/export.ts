import { DatabaseManager } from '../db.js';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Interface for ExportArgs.
 */
interface ExportArgs {
  /**
   * The path to the vault.
   */
  vaultPath?: string;
}

/**
 * Interface for MemoryRecord.
 */
interface MemoryRecord {
  /**
   * The ID of the memory block.
   */
  id: any;

  /**
   * The text of the memory block.
   */
  text: string;

  /**
   * The metadata of the memory block.
   */
  metadata: any;

  /**
   * The importance of the memory block.
   */
  importance: number;

  /**
   * The creation date of the memory block.
   */
  created_at: string;

  /**
   * The last access date of the memory block.
   */
  last_accessed_at: string;

  /**
   * The access count of the memory block.
   */
  accessed_count: number;
}

/**
 * Exports memories from the database.
 *
 * @param args - The export arguments.
 * @returns An object with the export result.
 */
export async function executeMemoryExport(args: ExportArgs = {}): Promise<{ success: true, vault_path: string, exported_files: string[], total_exported: number, sync_time: string }> {
  /**
   * The export directory.
   */
  const exportDir = args.vaultPath ? path.resolve(args.vaultPath) : path.join(process.cwd(), 'memories_export');

  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const db = DatabaseManager.getInstance();
  const validTypes = ['semantic', 'episodic', 'procedural', 'relational', 'structural'];

  /**
   * Iterate over each memory type and export files if necessary.
   */
  for (const type of validTypes) {
    const filePath = path.join(exportDir, `${type}.md`);
    if (!fs.existsSync(filePath)) continue;

    const mtime = fs.statSync(filePath).mtime;
    const ledgerId = `sync_ledger:${type}`;
    const ledgerEntry = db.prepare('SELECT last_sync_time FROM sync_ledger WHERE id = ?').get(ledgerId) as any;
    const lastSync = ledgerEntry ? new Date(ledgerEntry.last_sync_time) : new Date(0);

    if (mtime > lastSync) {
      /**
       * Read the memory block file and process its content.
       */
      const content = fs.readFileSync(filePath, 'utf-8');
      const memoryBlocks = content.split('## Memory [');
      for (let i = 1; i < memoryBlocks.length; i++) {
        const block = memoryBlocks[i];
        const idMatch = block.match(/- \*\*ID\*\*: \`([^\`]+)\`/);
        if (!idMatch) continue;
        const dbId = idMatch[1];

        const contentMatch = block.match(/### Content\n((?:> .*\n?)+)/);
        if (contentMatch) {
          const cleanContent = contentMatch[1].split('\n').map(l => l.replace(/^> ?/, '')).join('\n').trim();
          if (cleanContent) {
            const mem = db.prepare('SELECT text FROM memory WHERE id = ?').get(dbId) as any;
            if (mem && mem.text.trim() !== cleanContent) {
              db.prepare('UPDATE memory SET text = ?, importance = 0.9, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?').run(cleanContent, dbId);
            }
          }
        }
      }
    }
  }

  /**
   * Retrieve all memories from the database.
   */
  const memories = db.prepare('SELECT id, text, metadata, importance, created_at, last_accessed_at, accessed_count FROM memory WHERE is_active = 1').all() as MemoryRecord[];
  const grouped = new Map<string, MemoryRecord[]>();
  for (const t of validTypes) grouped.set(t, []);

  /**
   * Group memories by their type and sort them by importance.
   */
  for (const mem of memories) {
    let meta: any = {}; try { meta = typeof mem.metadata === 'string' ? JSON.parse(mem.metadata) : mem.metadata; } catch(e) {}
    const rawType = meta?.type || 'semantic';
    grouped.get(validTypes.includes(rawType.toLowerCase()) ? rawType.toLowerCase() : 'semantic')!.push(mem);
  }

  /**
   * Export each group of memories to a file.
   */
  const exportedFiles: string[] = [];
  const syncTime = new Date().toISOString();

  for (const [type, list] of grouped.entries()) {
    const filePath = path.join(exportDir, `${type}.md`);
    const ledgerId = `sync_ledger:${type}`;
    
    if (list.length === 0) {
      if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); db.prepare('DELETE FROM sync_ledger WHERE id = ?').run(ledgerId); }
      continue;
    }

    list.sort((a, b) => b.importance - a.importance);
    let md = `---\ntype: agent_memory\ncategory: ${type}\nupdated_at: ${syncTime}\ntotal_records: ${list.length}\n---\n\n# ${type.charAt(0).toUpperCase() + type.slice(1)} Memories\n\n`;

    for (const mem of list) {
      const shortId = String(mem.id).split(':')[1] || String(mem.id);
      let metaStr = '{}'; try { metaStr = JSON.stringify(typeof mem.metadata === 'string' ? JSON.parse(mem.metadata) : mem.metadata, null, 2); } catch(e) {}
      md += `## Memory [${shortId}]\n- **ID**: \`${mem.id}\`\n- **Importance**: ${mem.importance.toFixed(3)}\n- **Created At**: ${mem.created_at}\n- **Last Accessed**: ${mem.last_accessed_at}\n- **Access Count**: ${mem.accessed_count || 0}\n\n### Content\n> ${mem.text.replace(/\n/g, '\n> ')}\n\n<details>\n<summary>Metadata</summary>\n\n\`\`\`json\n${metaStr}\n\`\`\`\n\n</details>\n\n---\n\n`;
    }

    fs.writeFileSync(filePath, md, 'utf-8');
    db.prepare('INSERT INTO sync_ledger (id, file_path, last_sync_time) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_sync_time = excluded.last_sync_time').run(ledgerId, filePath, fs.statSync(filePath).mtime.toISOString());
    exportedFiles.push(filePath);
  }

  return { success: true, vault_path: exportDir, exported_files: exportedFiles, total_exported: memories.length, sync_time: syncTime };
}