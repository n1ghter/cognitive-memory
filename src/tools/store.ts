import { z } from 'zod';
import { EmbeddingCache } from '../cache.js';
import {
  DatabaseManager,
  generateId,
  type MemoryScope,
  normalizeRecordId,
  scopeToSchemas,
} from '../db.js';
import { getEmbeddingProvider, isEmbeddingDimensionError } from '../retrieval.js';

/**
 * Memory profile isolation tier: user preferences/context (default), active working context, or core agent facts.
 */
export type MemoryProfile = 'user' | 'working' | 'agent_core';
export const MemoryProfileSchema = z.enum(['user', 'working', 'agent_core']);

/**
 * Zod schema for validating the reserved zero-copy 'ref' pointer space.
 */
export const PointerRefSchema = z
  .object({
    vault_path: z.string().optional(),
    wikilink: z.string().optional(),
    source_hash: z.string().optional(),
    section: z.string().optional(),
  })
  .passthrough();

export type PointerRef = z.infer<typeof PointerRefSchema>;

/**
 * Metadata structure supporting zero-copy pointers to external Markdown/Obsidian sources.
 */
export interface PointerMetadata {
  profile?: MemoryProfile;
  ref?: PointerRef;
  vault_path?: string;
  wikilink?: string;
  source_hash?: string;
  section?: string;
  [key: string]: any;
}

/**
 * Schema validating store metadata without breaking arbitrary user-supplied fields.
 */
export const StoreMetadataSchema = z.record(z.string(), z.any()).and(
  z
    .object({
      profile: MemoryProfileSchema.optional(),
      ref: PointerRefSchema.optional(),
    })
    .passthrough()
);

/**
 * Arguments for the memory store function.
 */
export interface StoreArgs {
  /**
   * The text to be stored.
   */
  text: string;
  /**
   * Optional metadata associated with the text (supports PointerMetadata).
   */
  metadata?: PointerMetadata;
  /**
   * Importance level of the text (default is 0.5).
   */
  importance?: number;
  /**
   * Database to store into: `local` (default) or `global`.
   */
  scope?: Exclude<MemoryScope, 'all'>;
  /**
   * Memory profile isolation: `user` (default), `working`, or `agent_core`.
   */
  profile?: MemoryProfile;
  /**
   * Optional ID of an older memory that this new fact temporally supersedes.
   * Marks the older memory with valid_until and superseded_by and adds a `supersedes` edge.
   */
  supersedes?: string;
}

/**
 * Executes a memory store operation with zero-copy pointer validation, profile isolation, exact deduplication,
 * and optional temporal supersession.
 *
 * @param args - The arguments for the function.
 * @returns A promise that resolves with an object containing a success flag and a stored record.
 */
export async function executeMemoryStore(args: StoreArgs) {
  const { text, metadata = {}, importance = 0.5, scope = 'local', profile, supersedes } = args;

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: "text" must be a non-empty string');
  }
  if (scope !== 'local' && scope !== 'global') {
    throw new Error('Invalid input: "scope" must be "local" or "global"');
  }

  const resolvedProfile: MemoryProfile = profile || metadata.profile || 'user';
  const normalizedMetadata: PointerMetadata = { ...metadata, profile: resolvedProfile };

  try {
    StoreMetadataSchema.parse(normalizedMetadata);
  } catch (err: any) {
    throw new Error(`Invalid metadata schema: ${err.message}`);
  }

  const [schema] = scopeToSchemas(scope);
  const cleanText = text.trim();
  const db = DatabaseManager.getInstance();

  // Deduplicate exact content match within the same schema + profile (bypassed during consolidation)
  const isConsolidation = Boolean(normalizedMetadata.consolidated_from);
  if (!isConsolidation) {
    const existing = db
      .prepare(`
        SELECT id, rowid, importance, metadata
        FROM ${schema}.memory
        WHERE text = ? AND is_active = 1
          AND (
            json_extract(metadata, '$.profile') = ? OR
            (? = 'user' AND json_extract(metadata, '$.profile') IS NULL)
          )
        LIMIT 1
      `)
      .get(cleanText, resolvedProfile, resolvedProfile) as
      | {
          id: string;
          rowid: number | bigint;
          importance: number;
          metadata: string;
        }
      | undefined;

    if (existing) {
      let mergedMetadata: PointerMetadata = normalizedMetadata;
      try {
        const parsed = JSON.parse(existing.metadata || '{}');
        mergedMetadata = { ...parsed, ...normalizedMetadata };
      } catch {
        // Fall back to incoming metadata if existing metadata is not valid JSON
      }

      const updatedImportance = Math.max(existing.importance, importance);
      db.prepare(`
        UPDATE ${schema}.memory
        SET last_accessed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            accessed_count = accessed_count + 1,
            importance = ?,
            metadata = ?
        WHERE rowid = ?
      `).run(updatedImportance, JSON.stringify(mergedMetadata), existing.rowid);

      return {
        success: true,
        message: 'Memory updated (idempotent match found)',
        record: {
          id: existing.id,
          text: cleanText,
          metadata: mergedMetadata,
          importance: updatedImportance,
          is_active: true,
          scope: scope,
        },
      };
    }
  }

  // 1. Attempt to retrieve the vector embedding (gracefully optional when Ollama is offline or EMBEDDING_PROVIDER=none)
  const provider = getEmbeddingProvider();
  let embedding: number[] | null = null;
  if (provider !== 'none') {
    try {
      embedding = await EmbeddingCache.getEmbedding(cleanText);
      DatabaseManager.ensureVectorTable(embedding.length, schema);
    } catch (err) {
      if (isEmbeddingDimensionError(err) || provider === 'ollama') {
        throw err;
      }
      console.error(
        '[Store] Embedding provider unavailable; storing in zero-Ollama lexical (FTS5) mode:',
        err instanceof Error ? err.message : String(err)
      );
      embedding = null;
    }
  }

  // 2. Generate UUID for record
  const id = generateId();
  let supersededTargetId: string | null = null;

  // 3. Run transaction to ensure atomicity between metadata, FTS5 trigger, optional vector table, and temporal supersession
  const storeTx = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO ${schema}.memory (
        id, text, metadata, importance, is_active,
        created_at, updated_at, last_accessed_at, accessed_count, valid_from
      )
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(id, cleanText, JSON.stringify(normalizedMetadata), importance, 1);

    if (embedding) {
      // lastInsertRowid is often a BigInt in better-sqlite3. Pass it as BigInt
      // for sqlite-vec compatibility to avoid "Only integers are allows for primary key values"
      const rowid = BigInt(info.lastInsertRowid);

      const vecStmt = db.prepare(`
        INSERT INTO ${schema}.vec_memory (rowid, embedding)
        VALUES (?, ?)
      `);

      // sqlite-vec requires Float32Array
      const floatArray = new Float32Array(embedding);
      vecStmt.run(rowid, floatArray);
    }

    if (supersedes) {
      const normalizedOld = normalizeRecordId(supersedes);
      const oldRow = db
        .prepare(`SELECT id FROM ${schema}.memory WHERE id = ? OR id = ? LIMIT 1`)
        .get(supersedes, normalizedOld) as { id: string } | undefined;

      if (oldRow) {
        supersededTargetId = oldRow.id;
        db.prepare(`
          UPDATE ${schema}.memory
          SET valid_until = CURRENT_TIMESTAMP,
              superseded_by = ?,
              is_active = 0,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(id, oldRow.id);

        db.prepare(`
          INSERT INTO ${schema}.edges (id, source_id, target_id, relation_type, metadata, is_external, created_at)
          VALUES (?, ?, ?, 'supersedes', '{}', 0, CURRENT_TIMESTAMP)
        `).run(generateId(), id, oldRow.id);
      }
    }

    return id;
  });

  storeTx();

  return {
    success: true,
    message: embedding
      ? 'Memory stored successfully'
      : 'Memory stored successfully (lexical FTS5 mode; embeddings offline)',
    indexed_vectors: Boolean(embedding),
    superseded_id: supersededTargetId,
    record: {
      id: id,
      text: cleanText,
      metadata: normalizedMetadata,
      importance: importance,
      is_active: true,
      scope: scope,
    },
  };
}
