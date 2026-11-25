import { EmbeddingCache } from '../cache.js';
import { DatabaseManager, type MemoryScope, scopeToSchemas, type VectorSchema } from '../db.js';
import {
  buildFtsQuery,
  computeTermCoverage,
  fuseReciprocalRank,
  getEmbeddingProvider,
  isEmbeddingDimensionError,
  isLexicalConfident,
  normalizeBm25,
  type SearchMode,
} from '../retrieval.js';
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
   * Optional threshold for similarity (0.0-1.0). Defaults to 0.6.
   * Set to <= 0 to return unfiltered top-k ranked matches.
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
  /**
   * Retrieval mode: `hybrid` (FTS5 BM25 + optional dense RRF, default), `bm25` (zero-Ollama lexical), or `vector` (dense only).
   */
  mode?: SearchMode;
}

interface CandidateRow {
  key: string;
  schema: VectorSchema;
  rowid: number | bigint;
  id: string;
  text: string;
  metadata: string | null;
  created_at: string;
  importance: number;
  last_accessed_at: string;
  accessed_count: number;
  vecSimilarity?: number;
  bm25Score?: number;
  termCoverage?: number;
  rrfScore?: number;
}

/**
 * Execute a memory search using Hybrid RRF (SQLite FTS5 BM25 + optional sqlite-vec cosine),
 * pure BM25 (zero-Ollama), or pure vector search.
 */
export async function executeMemorySearch(args: SearchArgs) {
  const {
    query,
    limit = 5,
    threshold = 0.6,
    scope = 'local',
    profile = 'all',
    mode = 'hybrid',
  } = args;

  if (!query || typeof query !== 'string') {
    throw new Error('Invalid input: "query" must be a non-empty string');
  }
  const schemas = scopeToSchemas(scope);
  const db = DatabaseManager.getInstance();
  const candidatePoolSize = Math.max(limit * 4, 25);

  const provider = getEmbeddingProvider();
  const shouldRunBm25 = mode !== 'vector';
  const shouldAttemptVector = mode !== 'bm25' && provider !== 'none';

  // 1. Optional dense embedding pass (gracefully falls back to BM25 when Ollama is offline in auto mode)
  let queryEmbedding: number[] | null = null;
  let fellBackToBm25 = false;

  if (shouldAttemptVector) {
    try {
      queryEmbedding = await EmbeddingCache.getEmbedding(query);
    } catch (err) {
      if (isEmbeddingDimensionError(err) || mode === 'vector' || provider === 'ollama') {
        throw err;
      }
      console.error(
        '[Search] Embedding provider unavailable; falling back to zero-Ollama FTS5 BM25:',
        err instanceof Error ? err.message : String(err)
      );
      queryEmbedding = null;
      fellBackToBm25 = true;
    }
  }

  // 2. Run FTS5 BM25 lexical search across requested schemas
  const { ftsQuery, terms } = shouldRunBm25 ? buildFtsQuery(query) : { ftsQuery: '', terms: [] };
  const bm25Candidates: CandidateRow[] = [];

  if (shouldRunBm25 && ftsQuery) {
    for (const schema of schemas) {
      const stmt = db.prepare(`
        SELECT
          m.rowid,
          m.id,
          m.text,
          m.metadata,
          m.created_at,
          m.importance,
          m.last_accessed_at,
          m.accessed_count,
          bm25(fts_memory) AS raw_bm25
        FROM ${schema}.fts_memory
        JOIN ${schema}.memory m ON ${schema}.fts_memory.rowid = m.rowid
        WHERE fts_memory MATCH ?
          AND m.is_active = 1
          AND (
            ? = 'all' OR
            (? = 'user' AND (json_extract(m.metadata, '$.profile') = 'user' OR json_extract(m.metadata, '$.profile') IS NULL)) OR
            (json_extract(m.metadata, '$.profile') = ?)
          )
        ORDER BY raw_bm25 ASC
        LIMIT ?
      `);
      const rows = stmt.all(ftsQuery, profile, profile, profile, candidatePoolSize) as any[];
      for (const r of rows) {
        const termCoverage = computeTermCoverage(terms, r.text);
        const bm25Score = Math.max(normalizeBm25(r.raw_bm25), termCoverage * 0.5);
        bm25Candidates.push({
          key: `${schema}:${r.id}`,
          schema,
          rowid: r.rowid,
          id: r.id,
          text: r.text,
          metadata: r.metadata,
          created_at: r.created_at,
          importance: r.importance,
          last_accessed_at: r.last_accessed_at,
          accessed_count: r.accessed_count,
          bm25Score,
          termCoverage,
        });
      }
    }
    bm25Candidates.sort((a, b) => (b.bm25Score ?? 0) - (a.bm25Score ?? 0));
  }

  // 3. Run single-pass CTE vector search across schemas that have a vector table
  const vecCandidates: CandidateRow[] = [];
  if (queryEmbedding) {
    const floatArray = new Float32Array(queryEmbedding);
    const maxDistance = mode === 'vector' ? 1.0 - threshold : 2.0;

    for (const schema of schemas) {
      if (DatabaseManager.getVectorDimension(schema) === null) {
        continue;
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
      const rows = stmt.all(
        floatArray,
        profile,
        profile,
        profile,
        maxDistance,
        mode === 'vector' ? limit : candidatePoolSize
      ) as any[];
      for (const r of rows) {
        vecCandidates.push({
          key: `${schema}:${r.id}`,
          schema,
          rowid: r.rowid,
          id: r.id,
          text: r.text,
          metadata: r.metadata,
          created_at: r.created_at,
          importance: r.importance,
          last_accessed_at: r.last_accessed_at,
          accessed_count: r.accessed_count,
          vecSimilarity: r.similarity,
        });
      }
    }
    vecCandidates.sort((a, b) => (b.vecSimilarity ?? -1) - (a.vecSimilarity ?? -1));
  }

  // 4. Merge candidates and apply mode-appropriate ranking & thresholding
  const mergedMap = new Map<string, CandidateRow>();
  for (const row of bm25Candidates) {
    mergedMap.set(row.key, { ...row });
  }
  for (const row of vecCandidates) {
    const existing = mergedMap.get(row.key);
    if (existing) {
      existing.vecSimilarity = row.vecSimilarity;
    } else {
      mergedMap.set(row.key, { ...row });
    }
  }

  const effectiveMode: 'hybrid' | 'bm25' | 'vector' | 'bm25_fallback' =
    mode === 'vector'
      ? 'vector'
      : mode === 'bm25' || provider === 'none'
        ? 'bm25'
        : fellBackToBm25 || vecCandidates.length === 0
          ? fellBackToBm25
            ? 'bm25_fallback'
            : 'bm25'
          : bm25Candidates.length === 0
            ? 'vector'
            : 'hybrid';

  let ranked: CandidateRow[];

  if (effectiveMode === 'hybrid') {
    const rrfMap = fuseReciprocalRank(
      bm25Candidates.map((r) => r.key),
      vecCandidates.map((r) => r.key)
    );
    ranked = [...mergedMap.values()]
      .map((row) => ({
        ...row,
        rrfScore: rrfMap.get(row.key)?.rrfScore ?? 0,
      }))
      .filter((row) => {
        if (threshold <= 0) return true;
        const vecPass = (row.vecSimilarity ?? -1) >= threshold;
        const bm25Pass =
          row.bm25Score !== undefined &&
          isLexicalConfident(row.bm25Score, row.termCoverage ?? 0, terms.length, threshold);
        return vecPass || bm25Pass;
      })
      .sort((a, b) => {
        const diff = (b.rrfScore ?? 0) - (a.rrfScore ?? 0);
        if (Math.abs(diff) > 1e-9) return diff;
        return (b.vecSimilarity ?? b.bm25Score ?? 0) - (a.vecSimilarity ?? a.bm25Score ?? 0);
      })
      .slice(0, limit);
  } else if (effectiveMode === 'vector') {
    ranked = vecCandidates
      .filter((row) => threshold <= 0 || (row.vecSimilarity ?? -1) >= threshold)
      .slice(0, limit);
  } else {
    // bm25 or bm25_fallback
    ranked = bm25Candidates
      .filter(
        (row) =>
          threshold <= 0 ||
          isLexicalConfident(row.bm25Score ?? 0, row.termCoverage ?? 0, terms.length, threshold)
      )
      .slice(0, limit);
  }

  // 5. Update last_accessed_at and increment accessed_count per schema
  for (const schema of schemas) {
    const rowids = ranked.filter((r) => r.schema === schema).map((r) => r.rowid);
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
    success: true,
    retrieval_mode: effectiveMode,
    results: ranked.map((r) => {
      let parsedMetadata: any = {};
      if (r.metadata) {
        try {
          parsedMetadata = JSON.parse(r.metadata);
        } catch (_e) {
          parsedMetadata = r.metadata;
        }
      }
      const primaryScore =
        effectiveMode === 'hybrid'
          ? (r.rrfScore ?? r.vecSimilarity ?? r.bm25Score ?? 0)
          : effectiveMode === 'vector'
            ? (r.vecSimilarity ?? 0)
            : (r.bm25Score ?? 0);

      return {
        id: r.id,
        text: r.text,
        metadata: parsedMetadata,
        similarity: primaryScore,
        vector_similarity: r.vecSimilarity ?? null,
        bm25_score: r.bm25Score ?? null,
        rrf_score: r.rrfScore ?? null,
        importance: r.importance,
        created_at: r.created_at,
        last_accessed_at: r.last_accessed_at,
        accessed_count: r.accessed_count,
        scope: r.schema === 'global' ? 'global' : 'local',
      };
    }),
  };
}
