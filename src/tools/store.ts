import { z } from 'zod';
import { EmbeddingCache } from '../cache.js';
import { DatabaseManager, generateId, type MemoryScope, scopeToSchemas } from '../db.js';

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
}

/**
 * Executes a memory store operation with zero-copy pointer validation, profile isolation, and exact deduplication.
 *
 * @param args - The arguments for the function.
 * @returns A promise that resolves with an object containing a success flag and a stored record.
 */
export async function executeMemoryStore(args: StoreArgs) {
  const { text, metadata = {}, importance = 0.5, scope = 'local', profile } = args;

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

  // 1. Retrieve the vector embedding
  const embedding = await EmbeddingCache.getEmbedding(cleanText);
  DatabaseManager.ensureVectorTable(embedding.length, schema);

  // 2. Generate UUID for record
  const id = generateId();

  // 3. Run transaction to ensure atomicity between metadata and vector tables
  const storeTx = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO ${schema}.memory (id, text, metadata, importance, is_active, created_at, updated_at, last_accessed_at, accessed_count)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
    `);
    const info = stmt.run(id, cleanText, JSON.stringify(normalizedMetadata), importance, 1);

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

    return id;
  });

  storeTx();

  return {
    success: true,
    message: 'Memory stored successfully',
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
