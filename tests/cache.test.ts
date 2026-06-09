import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';

vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.1);
      vec[0] = text.length;
      return vec;
    }),
  },
}));

describe('EmbeddingCache', () => {
  afterEach(() => {
    (EmbeddingCache as any).l1Cache.clear();
    DatabaseManager.close();
    vi.restoreAllMocks();
  });

  it('should compute valid SHA-256 hash', () => {
    const hash1 = EmbeddingCache.computeHash('Hello World');
    const hash2 = EmbeddingCache.computeHash('hello world');
    const hash3 = EmbeddingCache.computeHash('  hello world  ');

    // Should ignore case and trim
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);

    // Check length of sha-256 hex string
    expect(hash1.length).toBe(64);
  });

  it('should throw an error if text is empty', async () => {
    await expect(EmbeddingCache.getEmbedding('   ')).rejects.toThrow(
      'Cannot compute embedding for empty text'
    );
  });

  it('should cache embedding in L1 and L2', async () => {
    // 1. First fetch - hits Ollama, saves to L1 and L2
    const vec1 = await EmbeddingCache.getEmbedding('Test memory cache');
    expect(vec1[0]).toBe('Test memory cache'.length);

    const { OllamaClient } = await import('../src/ollama.js');
    expect(OllamaClient.getEmbedding).toHaveBeenCalledTimes(1);

    // 2. Second fetch - hits L1 cache
    const vec2 = await EmbeddingCache.getEmbedding('Test memory cache');
    expect(vec2).toBe(vec1); // Exact same array reference
    expect(OllamaClient.getEmbedding).toHaveBeenCalledTimes(1);

    // 3. Clear L1, third fetch - hits L2 SQLite cache
    (EmbeddingCache as any).l1Cache.clear();
    const vec3 = await EmbeddingCache.getEmbedding('Test memory cache');
    expect(vec3.length).toBe(vec1.length);
    expect(vec3[0]).toBeCloseTo(vec1[0]);
    expect(vec3).not.toBe(vec1); // New array from DB
    expect(OllamaClient.getEmbedding).toHaveBeenCalledTimes(1);
  });

  it('should handle L2 cache read errors gracefully', async () => {
    const db = DatabaseManager.getInstance();
    const spy = vi.spyOn(db, 'prepare').mockImplementationOnce(() => {
      throw new Error('SQLite read failed');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await EmbeddingCache.getEmbedding('New unread text');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Cache] SQLite cache lookup failed, falling back to Ollama:',
      expect.any(Error)
    );

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should handle L2 cache write errors gracefully', async () => {
    const db = DatabaseManager.getInstance();

    // First prepare in getEmbedding is for SELECT, second is for INSERT
    const originalPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('INSERT')) {
        throw new Error('SQLite write failed');
      }
      return originalPrepare(sql);
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await EmbeddingCache.getEmbedding('Text for write error');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Cache] Failed to write embedding to SQLite persistent cache:',
      expect.any(Error)
    );

    spy.mockRestore();
    consoleSpy.mockRestore();
  });
});
