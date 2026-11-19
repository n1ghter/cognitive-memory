import { EmbeddingCache } from '../cache.js';
import { DatabaseManager } from '../db.js';

/**
 * Search arguments.
 */
interface SearchArgs {
  /**
   * The search query string.
   */
  query: string;
  /**
   * Optional limit for the number of results to return. Defaults to 5.
   */
  limit?: number;
  /**
   * Optional threshold for similarity. Defaults to 0.6 (distance <= 0.4).
   */
  threshold?: number;
}

/**
 * Execute a memory search with the given query and optional parameters.
 * Optimized with subquery/CTE to compute vec_distance_cosine only once per row.
 *
 * @param args Search arguments.
 * @returns An object containing the result status and the searched items.
 */
export async function executeMemorySearch(args: SearchArgs) {
  const { query, limit = 5, threshold = 0.6 } = args;

  if (!query || typeof query !== 'string') {
    throw new Error('Invalid input: "query" must be a non-empty string');
  }

  // 1. Convert the query text into its vector embedding
  const queryEmbedding = await EmbeddingCache.getEmbedding(query);

  // 2. Fetch database client
  const db = DatabaseManager.getInstance();

  // 3. Query SQLite using sqlite-vec
  // Threshold of 0.6 similarity means distance <= 0.4
  const maxDistance = 1.0 - threshold;
  const floatArray = new Float32Array(queryEmbedding);

  // Optimized single-pass distance calculation via subquery/CTE
  const stmt = db.prepare(`
    WITH scored AS (
      SELECT 
        m.rowid,
        m.id, 
        m.text, 
        m.metadata, 
        m.created_at, 
        m.importance,
        m.last_accessed_at,
        m.accessed_count,
        vec_distance_cosine(v.embedding, ?) AS distance
      FROM memory m
      JOIN vec_memory v ON m.rowid = v.rowid
      WHERE m.is_active = 1
    )
    SELECT 
      rowid,
      id,
      text,
      metadata,
      created_at,
      importance,
      last_accessed_at,
      accessed_count,
      distance,
      (1.0 - distance) AS similarity
    FROM scored
    WHERE distance <= ?
    ORDER BY distance ASC
    LIMIT ?
  `);

  const results = stmt.all(floatArray, maxDistance, limit) as any[];

  // Update last_accessed_at and increment accessed_count
  if (results.length > 0) {
    const rowids = results.map((r) => r.rowid);
    const placeholders = rowids.map(() => '?').join(',');
    try {
      db.prepare(`
        UPDATE memory 
        SET last_accessed_at = CURRENT_TIMESTAMP, 
            accessed_count = accessed_count + 1 
        WHERE rowid IN (${placeholders})
      `).run(...rowids);
    } catch (err: any) {
      console.error('[Search] Failed to update access stats:', err);
    }
  }

  return {
    /**
     * Whether the search was successful.
     */
    success: true,
    /**
     * The searched items with their similarity scores.
     */
    results: results.map((r: any) => {
      let parsedMetadata = {};
      if (r.metadata) {
        try {
          parsedMetadata = JSON.parse(r.metadata);
        } catch (_e) {
          parsedMetadata = r.metadata;
        }
      }
      return {
        id: r.id,
        text: r.text,
        metadata: parsedMetadata,
        similarity: r.similarity,
        importance: r.importance,
        created_at: r.created_at,
        last_accessed_at: r.last_accessed_at,
        accessed_count: r.accessed_count,
      };
    }),
  };
}
