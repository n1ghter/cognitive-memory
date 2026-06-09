import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryConsolidate } from '../src/tools/consolidate.js';
import { executeMemoryStore } from '../src/tools/store.js';

vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.1);
      vec[0] = text.length;
      return vec;
    }),
    generateText: vi.fn(async (_prompt: string, _system?: string) => {
      return JSON.stringify({
        consolidatedText: 'Consolidated memory',
        metadata: { merged: true },
      });
    }),
  },
}));

describe('Memory Consolidate', () => {
  afterEach(() => {
    DatabaseManager.close();
  });

  it('should not break if less than 3 memories', async () => {
    await executeMemoryStore({ text: 'Not enough 1' });
    const res = await executeMemoryConsolidate();
    expect(res.success).toBe(true);
    expect(res.status).toBe('Deduplication running in background');
  });

  it('should consolidate active memories', async () => {
    await executeMemoryStore({ text: 'Memory A about cats' });
    await executeMemoryStore({ text: 'Memory B about cats' });
    await executeMemoryStore({ text: 'Memory C about cats' });

    const res = await executeMemoryConsolidate();
    expect(res.success).toBe(true);

    const db = DatabaseManager.getInstance();
    const rows = db
      .prepare('SELECT id, is_active FROM memory WHERE text LIKE ?')
      .all('%Consolidated memory%') as any[];
    // At least one memory was consolidated
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.is_active === 1)).toBe(true);
  });

  it('should prune old memories whose importance decays below 0.25', async () => {
    // Manually insert an old memory with importance 1.0 but accessed 400 hours ago
    const db = DatabaseManager.getInstance();
    const oldTime = new Date(Date.now() - 400 * 3600000).toISOString();
    db.prepare(`
      INSERT INTO memory (id, text, metadata, importance, is_active, created_at, last_accessed_at, accessed_count)
      VALUES ('mem-old-1', 'Very old memory', '{}', 1.0, 1, ?, ?, 1)
    `).run(oldTime, oldTime);
    db.prepare(`
      INSERT INTO vec_memory (rowid, embedding)
      VALUES (last_insert_rowid(), ?)
    `).run(new Float32Array(4096).fill(0.1));

    const res = await executeMemoryConsolidate();
    expect(res.success).toBe(true);
    expect(res.pruned).toBeGreaterThanOrEqual(1);

    const check = db.prepare('SELECT is_active FROM memory WHERE id = ?').get('mem-old-1') as any;
    expect(check.is_active).toBe(0);
  });

  it('should handle errors gracefully during generation', async () => {
    const { OllamaClient } = await import('../src/ollama.js');
    vi.mocked(OllamaClient.generateText).mockRejectedValueOnce(new Error('LLM error'));

    // We need memories that will trigger deduplication
    await executeMemoryStore({ text: 'Error memory A' });
    await executeMemoryStore({ text: 'Error memory B' });

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await executeMemoryConsolidate();
    expect(res.success).toBe(true); // Should not crash
    expect(consoleSpy).toHaveBeenCalledWith('Consolidate err:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});
