import { DatabaseManager, generateId } from '../db.js';

/**
 * Interface for graph relate arguments.
 */
interface GraphRelateArgs {
  /**
   * The ID of the source node in the graph.
   */
  sourceId: string;
  /**
   * The ID of the target node in the graph.
   */
  targetId: string;
  /**
   * The type of relation between the source and target nodes.
   */
  relationType: string;
  /**
   * Optional metadata for the relation.
   */
  metadata?: any;
}

/**
 * Executes a memory relate operation on the database.
 *
 * @param args The arguments for the graph relate operation.
 * @returns An object containing information about the created edge.
 */
export async function executeMemoryRelate(args: GraphRelateArgs) {
  const { sourceId, targetId, relationType, metadata = {} } = args;

  if (!sourceId || !targetId || !relationType) {
    throw new Error('Invalid input: sourceId, targetId, and relationType are required');
  }

  const normalizedRelationType = relationType.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const isExternalTarget = targetId.startsWith('obsidian://') || targetId.startsWith('vault://');

  if (isExternalTarget) {
    if (normalizedRelationType !== 'grounded_in' && normalizedRelationType !== 'references') {
      throw new Error(
        'External targets are only permitted for "grounded_in" or "references" relation types'
      );
    }
  }

  const db = DatabaseManager.getInstance();
  const edgeId = generateId();

  // Keep foreign key integrity without polluting active memory queries/exports (is_active = 0)
  if (isExternalTarget) {
    db.prepare(`
      INSERT OR IGNORE INTO memory (id, text, metadata, importance, is_active, created_at, updated_at, last_accessed_at, accessed_count)
      VALUES (?, ?, ?, 0.0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
    `).run(targetId, targetId, JSON.stringify({ is_external: true, uri: targetId }));
  }

  const stmt = db.prepare(`
    INSERT INTO edges (id, source_id, target_id, relation_type, metadata, is_external, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    edgeId,
    sourceId,
    targetId,
    normalizedRelationType,
    JSON.stringify(metadata),
    isExternalTarget ? 1 : 0
  );

  return {
    success: true,
    message: `Successfully created relation '${relationType}' between '${sourceId}' and '${targetId}'`,
    edge: {
      id: edgeId,
      source_id: sourceId,
      target_id: targetId,
      relation_type: relationType,
      is_external: isExternalTarget,
    },
  };
}
