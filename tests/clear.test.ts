import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemoryClearAll } from '../src/tools/clear.js';
import { executeMemoryRelate } from '../src/tools/graph.js';
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

describe('Memory Clear All', () => {
  afterEach(() => {
    DatabaseManager.close();
  });

  it('should clear all data if confirmed', async () => {
    const s1 = await executeMemoryStore({ text: 'Test 1' });
    const s2 = await executeMemoryStore({ text: 'Test 2' });
    await executeMemoryRelate({ sourceId: s1.record.id, targetId: s2.record.id, relationType: 'test' });

    const clearRes = await executeMemoryClearAll({ confirm: true });
    expect(clearRes.status).toBe('success');

    const db = DatabaseManager.getInstance();
    expect(db.prepare('SELECT COUNT(*) as c FROM memory').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM vec_memory').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM edges').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM embedding_cache').get() as any).toEqual({ c: 0 });
  });

  it('should fail if not confirmed', async () => {
    await expect(executeMemoryClearAll({ confirm: false })).rejects.toThrow('You must pass confirm: true to wipe all memories.');
  });
});
