import { z } from 'zod';
import { EmbeddingCache } from '../cache.js';
import { DatabaseManager, generateId } from '../db.js';

/**
 * Zod schema for validating the reserved 'ref' pointer space.
 */
export type MemoryProfile = 'user' | 'working' | 'agent_core';
export const MemoryProfileSchema = z.enum(['user', 'working', 'agent_core']);

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
 * Metadata structure supporting Zero-Copy Pointers to external knowledge bases.
 */
export interface PointerMetadata {
  /**
   * Memory profile isolation: user (default), working, or agent_core.
   */
  profile?: MemoryProfile;
  /**
   * Reserved space for external knowledge base pointers.
   */
  ref?: PointerRef;
  /**
   * Relative path inside an external vault/workspace (e.g. "cognitive-domain/knowledge-base/plan.md").
   */
  vault_path?: string;
  /**
   * Wikilink pointer (e.g. "[[plan#Heading]]").
   */
  wikilink?: string;
  /**
   * SHA-256 hash of the referenced note/file content at store time.
   */
  source_hash?: string;
  /**
   * Target section or anchor in the note.
   */
  section?: string;
  /**
   * Arbitrary additional custom metadata.
   */
  [key: string]: any;
}

/**
 * Schema validating the entire store metadata object without breaking backward compatibility.
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
interface StoreArgs {
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
   * Memory profile isolation: user (default), working, or agent_core.
   */
  profile?: MemoryProfile;
}

/**
 * Executes a memory store operation with Zero-Copy Pointer support and deduplication.
 *
 * @param args - The arguments for the function.
 * @returns A promise that resolves with an object containing a success flag and a stored record.
 */
export async function executeMemoryStore(args: StoreArgs) {
  const { text, metadata = {}, importance = 0.5, profile } = args;

  const resolvedProfile: MemoryProfile = profile || metadata.profile || 'user';
  metadata.profile = resolvedProfile;

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: "text" must be a non-empty string');
  }

  // Validate metadata schema including reserved ref space
  if (metadata && typeof metadata === 'object') {
    try {
      StoreMetadataSchema.parse(metadata);
    } catch (err: any) {
      throw new Error(`Invalid metadata schema: ${err.message}`);
    }
  }

  const cleanText = text.trim();
  const db = DatabaseManager.getInstance();

  // Deduplicate exact content match when no explicit external pointer or consolidation source is attached
  const isConsolidation = Boolean(metadata.consolidated_from);
  if (!isConsolidation) {
    const existingStmt = db.prepare(`
      SELECT id, rowid, importance, metadata 
      FROM memory 
      WHERE text = ? AND is_active = 1
        AND (
          json_extract(metadata, '$.profile') = ? OR 
          (? = 'user' AND json_extract(metadata, '$.profile') IS NULL)
        )
      LIMIT 1
    `);
    const existing = existingStmt.get(cleanText, resolvedProfile, resolvedProfile) as
      | {
          id: string;
          rowid: number | bigint;
          importance: number;
          metadata: string;
        }
      | undefined;

    if (existing) {
      let mergedMetadata = metadata;
      try {
        const parsed = JSON.parse(existing.metadata || '{}');
        mergedMetadata = { ...parsed, ...metadata };
      } catch {
        // ignore parse fallback
      }

      const updatedImportance = Math.max(existing.importance, importance);
      db.prepare(`
        UPDATE memory 
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
        },
      };
    }
  }

  // 1. Retrieve the vector embedding
  const embedding = await EmbeddingCache.getEmbedding(cleanText);

  // 2. Generate UUID for record
  const id = generateId();

  // 3. Run transaction to ensure atomicity between metadata and vector tables
  const storeTx = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO memory (id, text, metadata, importance, is_active, created_at, updated_at, last_accessed_at, accessed_count)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
    `);
    const info = stmt.run(id, cleanText, JSON.stringify(metadata), importance, 1);

    // lastInsertRowid is often a BigInt in better-sqlite3. Pass it as BigInt
    // for sqlite-vec compatibility to avoid "Only integers are allows for primary key values"
    const rowid = BigInt(info.lastInsertRowid);

    const vecStmt = db.prepare(`
      INSERT INTO vec_memory (rowid, embedding)
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
      metadata: metadata,
      importance: importance,
      is_active: true,
    },
  };
}
