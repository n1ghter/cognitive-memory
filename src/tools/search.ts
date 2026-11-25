import { EmbeddingCache } from '../cache.js';
import { DatabaseManager, type MemoryScope, scopeToSchemas } from '../db.js';
import type { MemoryProfile } from './store.js';

/**
 * Search arguments.
 */
export interface SearchArgs {
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
  /**
   * Optional database scope to search: `local` (default), `global`, or `all`.
   */
  scope?: MemoryScope;
  /**
   * Optional memory profile filter: `user`, `working`, `agent_core`, or `all` (default).
   */
  profile?: MemoryProfile | 'all';
}

/**
 * Execute a memory search with the given query and optional parameters.
 * Uses a single-pass CTE to compute vec_distance_cosine once per row per schema.
 *
 * @param args Search arguments.
 * @returns An object containing the result status and the searched items.
 */
export async function executeMemorySearch(args: SearchArgs) {
  const { query, limit = 5, threshold = 0.6, scope = 'local', profile = 'all' } = args;

  if (!query || typeof query !== 'string') {
    throw new Error('Invalid input: "query" must be a non-empty string');
  }
  const schemas = scopeToSchemas(scope);

  // 1. Convert the query text into its vector embedding
  const queryEmbedding = await EmbeddingCache.getEmbedding(query);

  // 2. Fetch database client
  const db = DatabaseManager.getInstance();

  // 3. Query SQLite using sqlite-vec
  // Threshold of 0.6 similarity means distance <= 0.4
  const maxDistance = 1.0 - threshold;

  const floatArray = new Float32Array(queryEmbedding);

  // Each schema is queried with a single-pass CTE, then merged by similarity so `all` returns the best overall matches.
  const results = schemas
    .flatMap((schema) => {
      // A schema that has never stored a memory has no vector table yet, so it has nothing to return.
      if (DatabaseManager.getVectorDimension(schema) === null) {
        return [];
      }
      DatabaseManager.ensureVectorTable(queryEmbedding.length, schema);
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
          FROM ${schema}.memory m
          JOIN ${schema}.vec_memory v ON m.rowid = v.rowid
          WHERE m.is_active = 1
            AND (
              ? = 'all' OR
              (? = 'user' AND (json_extract(m.metadata, '$.profile') = 'user' OR json_extract(m.metadata, '$.profile') IS NULL)) OR
              (json_extract(m.metadata, '$.profile') = ?)
            )
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
          (1.0 - distance) AS similarity
        FROM scored
        WHERE distance <= ?
        ORDER BY distance ASC
        LIMIT ?
      `);
      const rows = stmt.all(floatArray, profile, profile, profile, maxDistance, limit) as any[];
      return rows.map((r) => ({ ...r, schema }));
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  // Update last_accessed_at and increment accessed_count
  for (const schema of schemas) {
    const rowids = results.filter((r) => r.schema === schema).map((r) => r.rowid);
    if (rowids.length === 0) continue;
    const placeholders = rowids.map(() => '?').join(',');
    try {
      db.prepare(`
        UPDATE ${schema}.memory 
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
      let parsedMetadata: any = {};
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
        scope: r.schema === 'global' ? 'global' : 'local',
      };
    }),
  };
}
