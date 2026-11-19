import { createHash } from 'node:crypto';
import { DatabaseManager } from './db.js';
import { OllamaClient } from './ollama.js';

/**
 * A fast L1 In-Memory Cache with bounded LRU eviction used to store computed embeddings.
 */
export class EmbeddingCache {
  /**
   * The ultra-fast in-memory cache for storing computed embeddings.
   * Uses Map's insertion-order iteration to provide an O(1) LRU eviction.
   * @private
   */
  private static l1Cache = new Map<string, number[]>();

  /**
   * Maximum allowed items in L1 memory cache before oldest entries are evicted.
   */
  public static readonly MAX_CACHE_SIZE = 1000;

  /**
   * Computes a SHA-256 hash for the given text.
   *
   * @param text The input text to compute the hash for.
   * @returns A hexadecimal representation of the hash value.
   */
  public static computeHash(text: string): string {
    return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  }

  /**
   * Helper to insert into L1 cache with LRU eviction.
   * @private
   */
  private static setL1(hash: string, embedding: number[]): void {
    if (EmbeddingCache.l1Cache.has(hash)) {
      EmbeddingCache.l1Cache.delete(hash);
    } else if (EmbeddingCache.l1Cache.size >= EmbeddingCache.MAX_CACHE_SIZE) {
      // Map iterator returns oldest inserted key first
      const oldestKey = EmbeddingCache.l1Cache.keys().next().value;
      if (oldestKey) {
        EmbeddingCache.l1Cache.delete(oldestKey);
      }
    }
    EmbeddingCache.l1Cache.set(hash, embedding);
  }

  /**
   * Retrieves an embedding for the given text from the cache.
   *
   * @param text The input text to retrieve the embedding for.
   * @returns A promise that resolves with the embedded vector.
   */
  public static async getEmbedding(text: string): Promise<number[]> {
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Cannot compute embedding for empty text');
    }

    const hash = EmbeddingCache.computeHash(cleanText);

    // L1: Check high-speed in-memory cache (promote to MRU on hit)
    const l1Match = EmbeddingCache.l1Cache.get(hash);
    if (l1Match) {
      EmbeddingCache.setL1(hash, l1Match);
      DatabaseManager.ensureVectorTable(l1Match.length);
      return l1Match;
    }

    // L2: Fallback to persistent SQLite cache table
    const db = DatabaseManager.getInstance();
    try {
      const stmt = db.prepare('SELECT embedding FROM embedding_cache WHERE text_hash = ?');
      const row = stmt.get(hash) as { embedding: Buffer } | undefined;

      if (row?.embedding) {
        // Hydrate L1 cache
        const floatArray = new Float32Array(
          row.embedding.buffer,
          row.embedding.byteOffset,
          row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
        );
        const embeddingArray = Array.from(floatArray);
        DatabaseManager.ensureVectorTable(embeddingArray.length);
        EmbeddingCache.setL1(hash, embeddingArray);
        return embeddingArray;
      }
    } catch (err) {
      console.error('[Cache] SQLite cache lookup failed, falling back to Ollama:', err);
    }

    // L3: Cache Miss - Run Ollama Embedding Generator
    console.error(`[Cache] Cache miss for hash: ${hash}. Invoking local Ollama...`);
    const embedding = await OllamaClient.getEmbedding(cleanText);

    // Reject a dimension change before caching, so a mismatched vector never lingers
    DatabaseManager.ensureVectorTable(embedding.length);

    // Hydrate L1 Memory Cache with LRU bound
    EmbeddingCache.setL1(hash, embedding);

    // Hydrate L2 SQLite Cache Table
    try {
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO embedding_cache (text_hash, embedding, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      );
      const floatArray = new Float32Array(embedding);
      const buffer = Buffer.from(floatArray.buffer);
      stmt.run(hash, buffer);
    } catch (err: any) {
      console.error('[Cache] Failed to write embedding to SQLite persistent cache:', err);
    }

    return embedding;
  }

  /**
   * Empties the in-memory cache, e.g. after the persistent cache table is wiped.
   */
  public static clear(): void {
    EmbeddingCache.l1Cache.clear();
  }
}
