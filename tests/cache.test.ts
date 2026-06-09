import { describe, expect, it } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';

describe('EmbeddingCache', () => {
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
});
