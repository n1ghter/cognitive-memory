import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../db.js';

interface ExportArgs {
  vaultPath?: string;
}

interface MemoryRecord {
  id: string;
  text: string;
  metadata: any;
  importance: number;
  created_at: string;
  last_accessed_at: string;
  accessed_count: number;
}

interface EdgeRecord {
  source_id: string;
  target_id: string;
  relation_type: string;
}

/**
 * Exports memories from the database into Obsidian-compatible Markdown files.
 * Each memory becomes a separate .md file with [[Wikilinks]] to form a true Graph View.
 */
export async function executeMemoryExport(args: ExportArgs = {}): Promise<{
  success: true;
  vault_path: string;
  exported_files: string[];
  total_exported: number;
  sync_time: string;
}> {
  const exportDir = args.vaultPath
    ? path.resolve(args.vaultPath)
    : path.join(process.cwd(), 'memories_export');

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const db = DatabaseManager.getInstance();

  // 1. Fetch all memories
  const memories = db
    .prepare(
      'SELECT id, text, metadata, importance, created_at, updated_at, last_accessed_at, accessed_count FROM memory WHERE is_active = 1'
    )
    .all() as (MemoryRecord & { updated_at: string })[];

  // 2. Fetch all edges
  const edges = db
    .prepare('SELECT source_id, target_id, relation_type FROM edges')
    .all() as EdgeRecord[];

  // Build edge lookup maps
  const outgoingEdges = new Map<string, EdgeRecord[]>();
  const incomingEdges = new Map<string, EdgeRecord[]>();

  for (const edge of edges) {
    if (!outgoingEdges.has(edge.source_id)) outgoingEdges.set(edge.source_id, []);
    if (!incomingEdges.has(edge.target_id)) incomingEdges.set(edge.target_id, []);
    outgoingEdges.get(edge.source_id)?.push(edge);
    incomingEdges.get(edge.target_id)?.push(edge);
  }

  const exportedFiles: string[] = [];
  const syncTime = new Date().toISOString();
  let exportedCount = 0;

  // 3. Generate a Markdown file for each memory
  for (const mem of memories) {
    const shortId = String(mem.id).split(':')[1] || String(mem.id);
    const fileName = `Memory_${shortId}.md`;
    const filePath = path.join(exportDir, fileName);

    // Incremental export check
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      let dbUpdatedMs = 0;
      if (mem.updated_at) {
        dbUpdatedMs = new Date(mem.updated_at.replace(' ', 'T') + 'Z').getTime();
      } // If the file on disk is newer or same as the database, skip overwrite
      if (stat.mtimeMs >= dbUpdatedMs - 2000) {
        continue;
      }
    }

    let meta: any = {};
    try {
      meta = typeof mem.metadata === 'string' ? JSON.parse(mem.metadata) : mem.metadata;
    } catch (_e) {}

    const category = meta?.type || 'semantic';

    // Frontmatter
    let md = `---
id: ${shortId}
type: agent_memory
category: ${category}
importance: ${mem.importance.toFixed(3)}
created_at: ${mem.created_at}
last_accessed: ${mem.last_accessed_at}
access_count: ${mem.accessed_count || 0}
updated_at: ${syncTime}
---

# ${category.charAt(0).toUpperCase() + category.slice(1)} Memory [${shortId}]

> ${mem.text.replace(/\n/g, '\n> ')}

## Graph Relations
`;

    // Add explicit Obsidian Wikilinks for Obsidian Graph View
    const outEdges = outgoingEdges.get(mem.id) || [];
    const inEdges = incomingEdges.get(mem.id) || [];

    if (outEdges.length === 0 && inEdges.length === 0) {
      md += `*No direct relations to other memories.*\n`;
    } else {
      for (const edge of outEdges) {
        const targetShortId = String(edge.target_id).split(':')[1] || String(edge.target_id);
        md += `- **${edge.relation_type}** ➡️ [[Memory_${targetShortId}]]\n`;
      }
      for (const edge of inEdges) {
        const sourceShortId = String(edge.source_id).split(':')[1] || String(edge.source_id);
        md += `- ⬅️ **${edge.relation_type}** by [[Memory_${sourceShortId}]]\n`;
      }
    }

    // Add hidden metadata block
    let metaStr = '{}';
    try {
      metaStr = JSON.stringify(meta, null, 2);
    } catch (_e) {}

    md += `
<details>
<summary>Raw Metadata</summary>

\`\`\`json
${metaStr}
\`\`\`

</details>
`;

    fs.writeFileSync(filePath, md, 'utf-8');

    // Update the mtime of the file to match the syncTime so future imports don't re-import it
    const syncTimeMs = new Date(syncTime).getTime();
    fs.utimesSync(filePath, new Date(syncTimeMs), new Date(syncTimeMs));

    exportedFiles.push(filePath);
    exportedCount++;
  }

  // Write .sync_state.json for deletion tracking
  const exportedIds = memories.map((m) => m.id);
  const syncStatePath = path.join(exportDir, '.sync_state.json');
  fs.writeFileSync(
    syncStatePath,
    JSON.stringify({
      exported_ids: exportedIds,
      sync_time: syncTime,
    }),
    'utf-8'
  );

  return {
    success: true,
    vault_path: exportDir,
    exported_files: exportedFiles,
    total_exported: exportedCount,
    sync_time: syncTime,
  };
}
