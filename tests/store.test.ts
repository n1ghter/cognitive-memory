import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { DatabaseManager } from '../src/db.js';

// Mock Ollama so we don't need a real container
vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      // Return a fake 4096-dim vector where the first element changes based on text length
      const vec = new Array(4096).fill(0.1);
      vec[0] = text.length; 
      return vec;
    }),
  },
}));

describe('Memory Store & Search (Integration)', () => {
  afterEach(() => {
    // We can clear DB or just close it
    DatabaseManager.close();
  });

  it('should store and search memory via sqlite-vec', async () => {
    const storeResult = await executeMemoryStore({
      text: 'Hello test database',
      metadata: { test: true },
      importance: 0.8
    });

    expect(storeResult.success).toBe(true);
    expect(storeResult.record).toBeDefined();
    expect(storeResult.record?.text).toBe('Hello test database');

    const searchResult = await executeMemorySearch({
      query: 'Hello test',
      limit: 1,
      threshold: 0.0
    });

    expect(searchResult.success).toBe(true);
    expect(searchResult.results.length).toBeGreaterThan(0);
    expect(searchResult.results[0].text).toBe('Hello test database');
  });
});
