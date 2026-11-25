import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../db.js';

interface ExportArgs {
  vaultPath?: string;
  includeSuperseded?: boolean;
}

interface MemoryRecord {
  id: string;
  text: string;
  metadata: any;
  importance: number;
  is_active: number;
  created_at: string;
  last_accessed_at: string;
  accessed_count: number;
  valid_from?: string | null;
  valid_until?: string | null;
  superseded_by?: string | null;
}

interface EdgeRecord {
  source_id: string;
  target_id: string;
  relation_type: string;
  is_external?: number;
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

  // 1. Fetch memories (active only by default, or include temporally superseded history)
  const whereClause = args.includeSuperseded
    ? "(is_active = 1 OR superseded_by IS NOT NULL) AND COALESCE(json_extract(metadata, '$.is_external'), 0) != 1"
    : 'is_active = 1 AND valid_until IS NULL';

  const memories = db
    .prepare(
      `SELECT id, text, metadata, importance, is_active, created_at, updated_at, last_accessed_at, accessed_count, valid_from, valid_until, superseded_by
       FROM memory
       WHERE ${whereClause}`
    )
    .all() as (MemoryRecord & { updated_at: string })[];

  // 2. Fetch all edges
  const edges = db
    .prepare(
      'SELECT source_id, target_id, relation_type, COALESCE(is_external, 0) AS is_external FROM edges'
    )
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
        dbUpdatedMs = new Date(`${mem.updated_at.replace(' ', 'T')}Z`).getTime();
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
    const profile = meta?.profile || 'user';
    const status = mem.valid_until ? 'superseded' : 'active';
    const temporalLines = [
      `profile: ${profile}`,
      `status: ${status}`,
      mem.valid_from ? `valid_from: ${mem.valid_from}` : null,
      mem.valid_until ? `valid_until: ${mem.valid_until}` : null,
      mem.superseded_by ? `superseded_by: ${mem.superseded_by}` : null,
      meta?.ref?.vault_path
        ? `ref_vault_path: "${String(meta.ref.vault_path).replace(/"/g, '\\"')}"`
        : null,
      meta?.ref?.wikilink
        ? `ref_wikilink: "${String(meta.ref.wikilink).replace(/"/g, '\\"')}"`
        : null,
      meta?.ref?.section ? `ref_section: "${String(meta.ref.section).replace(/"/g, '\\"')}"` : null,
      meta?.ref?.source_hash ? `ref_source_hash: ${meta.ref.source_hash}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Frontmatter
    let md = `---
id: ${shortId}
type: agent_memory
category: ${category}
${temporalLines}
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

    // Add explicit Obsidian Wikilinks (or raw external URIs) for Obsidian Graph View
    const outEdges = outgoingEdges.get(mem.id) || [];
    const inEdges = incomingEdges.get(mem.id) || [];

    if (outEdges.length === 0 && inEdges.length === 0) {
      md += `*No direct relations to other memories.*\n`;
    } else {
      for (const edge of outEdges) {
        if (
          edge.is_external === 1 ||
          edge.target_id.startsWith('obsidian://') ||
          edge.target_id.startsWith('vault://')
        ) {
          md += `- **${edge.relation_type}** ➡️ ${edge.target_id}\n`;
        } else {
          const targetShortId = String(edge.target_id).split(':')[1] || String(edge.target_id);
          md += `- **${edge.relation_type}** ➡️ [[Memory_${targetShortId}]]\n`;
        }
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
