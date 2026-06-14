import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryClearAll } from '../src/tools/clear.js';
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

describe('Memory Clear All', () => {
  afterEach(() => {
    DatabaseManager.close();
  });

  it('should clear all data if confirmed', async () => {
    const s1 = await executeMemoryStore({ text: 'Test 1' });
    const s2 = await executeMemoryStore({ text: 'Test 2' });
    await executeMemoryRelate({
      sourceId: s1.record.id,
      targetId: s2.record.id,
      relationType: 'test',
    });

    const clearRes = await executeMemoryClearAll({ confirm: true });
    expect(clearRes.status).toBe('success');

    const db = DatabaseManager.getInstance();
    expect(db.prepare('SELECT COUNT(*) as c FROM memory').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM vec_memory').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM edges').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM embedding_cache').get() as any).toEqual({ c: 0 });
  });

  it('should fail if not confirmed', async () => {
    await expect(executeMemoryClearAll({ confirm: false })).rejects.toThrow(
      'You must pass confirm: true to wipe all memories.'
    );
  });

  it('should rollback transaction if an error occurs during wipe', async () => {
    // We mock db.prepare to throw when 'DELETE FROM memory' is called
    const db = DatabaseManager.getInstance();
    const originalPrepare = db.prepare.bind(db);
    const execSpy = vi.spyOn(db, 'exec');
    const prepareSpy = vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('DELETE FROM memory')) {
        throw new Error('Simulated DB deletion error');
      }
      return originalPrepare(sql);
    });

    await expect(executeMemoryClearAll({ confirm: true })).rejects.toThrow(
      'Simulated DB deletion error'
    );

    // Should have started transaction
    expect(execSpy).toHaveBeenCalledWith('BEGIN TRANSACTION');
    // Should have rolled back
    expect(execSpy).toHaveBeenCalledWith('ROLLBACK');

    prepareSpy.mockRestore();
    execSpy.mockRestore();
  });
});
