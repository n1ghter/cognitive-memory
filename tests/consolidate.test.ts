import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemoryConsolidate } from '../src/tools/consolidate.js';
import { DatabaseManager } from '../src/db.js';

vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.1);
      vec[0] = text.length; 
      return vec;
    }),
    generateText: vi.fn(async (prompt: string, system?: string) => {
      return JSON.stringify({
        consolidatedText: "Consolidated memory",
        metadata: { merged: true }
      });
    })
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
    const rows = db.prepare('SELECT id, is_active FROM memory WHERE text LIKE ?').all('%Consolidated memory%') as any[];
    // At least one memory was consolidated (it processes at most 3 pairs)
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].is_active).toBe(1); 
  });
});
