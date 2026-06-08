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
  let { sourceId, targetId, relationType, metadata = {} } = args;

  if (!sourceId || !targetId || !relationType) {
    throw new Error('Invalid input: sourceId, targetId, and relationType are required');
  }

  const db = DatabaseManager.getInstance();
  const edgeId = generateId();

  /**
   * Prepares a SQL statement to insert an edge into the database.
   */
  const stmt = db.prepare(`
    INSERT INTO edges (id, source_id, target_id, relation_type, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(edgeId, sourceId, targetId, relationType.toLowerCase().replace(/[^a-z0-9_]/g, '_'), JSON.stringify(metadata));

  return {
    /**
     * Indicates whether the operation was successful.
     */
    success: true,
    /**
     * A message describing the outcome of the operation.
     */
    message: `Successfully created relation '${relationType}' between '${sourceId}' and '${targetId}'`,
    /**
     * Information about the created edge.
     */
    edge: {
      id: edgeId,
      source_id: sourceId,
      target_id: targetId,
      relation_type: relationType
    }
  };
}