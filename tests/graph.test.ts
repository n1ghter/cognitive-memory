import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryRelate } from '../src/tools/graph.js';
import { executeMemoryStore } from '../src/tools/store.js';

vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.1);
      vec[0] = text.length;
      return vec;
    }),
  },
}));

describe('Memory Relate', () => {
  afterEach(() => {
    DatabaseManager.close();
  });

  it('should create an edge between two valid memories', async () => {
    const s1 = await executeMemoryStore({ text: 'Concept A' });
    const s2 = await executeMemoryStore({ text: 'Concept B' });

    const relRes = await executeMemoryRelate({
      sourceId: s1.record.id,
      targetId: s2.record.id,
      relationType: 'related_to',
    });

    expect(relRes.success).toBe(true);
    expect(relRes.edge).toBeDefined();
    expect(relRes.edge.relation_type).toBe('related_to');
  });

  it('should fail if source does not exist', async () => {
    const s2 = await executeMemoryStore({ text: 'Concept B' });
    await expect(
      executeMemoryRelate({
        sourceId: 'fake-id',
        targetId: s2.record.id,
        relationType: 'related_to',
      })
    ).rejects.toThrow('FOREIGN KEY constraint failed'); // SQLite throws this
  });

  it('should fail if relation is empty', async () => {
    await expect(
      executeMemoryRelate({
        sourceId: 'id1',
        targetId: 'id2',
        relationType: '',
      })
    ).rejects.toThrow('Invalid input: sourceId, targetId, and relationType are required');
  });
});
