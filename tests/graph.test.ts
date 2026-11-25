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

  it('should allow external URI targets for grounded_in and references without polluting active memories', async () => {
    const s1 = await executeMemoryStore({ text: 'Observation about architecture' });

    const relRes = await executeMemoryRelate({
      sourceId: s1.record.id,
      targetId: 'obsidian://vault/workspace/system/arch.md',
      relationType: 'grounded_in',
    });

    expect(relRes.success).toBe(true);
    expect(relRes.edge.is_external).toBe(true);
    expect(relRes.edge.target_id).toBe('obsidian://vault/workspace/system/arch.md');

    const relRes2 = await executeMemoryRelate({
      sourceId: s1.record.id,
      targetId: 'vault://specs/zero-copy.md',
      relationType: 'references',
    });

    expect(relRes2.success).toBe(true);
    expect(relRes2.edge.is_external).toBe(true);

    // Verify external placeholder rows remain inactive so active queries/exports are never polluted
    const db = DatabaseManager.getInstance();
    const row = db
      .prepare('SELECT is_active FROM memory WHERE id = ?')
      .get('obsidian://vault/workspace/system/arch.md') as { is_active: number };
    expect(row.is_active).toBe(0);
  });

  it('should reject external URI target for unsupported relation types', async () => {
    const s1 = await executeMemoryStore({ text: 'Observation' });

    await expect(
      executeMemoryRelate({
        sourceId: s1.record.id,
        targetId: 'obsidian://vault/workspace/note.md',
        relationType: 'contradicts',
      })
    ).rejects.toThrow(
      'External targets are only permitted for "grounded_in" or "references" relation types'
    );
  });
});
