import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemoryDelete } from '../src/tools/delete.js';
import { executeMemorySearch } from '../src/tools/search.js';
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

describe('Memory Delete', () => {
  afterEach(() => {
    DatabaseManager.close();
  });

  it('should soft delete a memory', async () => {
    const storeRes = await executeMemoryStore({ text: 'Soft delete me' });
    const id = storeRes.record.id;

    const delRes = await executeMemoryDelete({ id, hard: false });
    expect(delRes.success).toBe(true);
    expect(delRes.deleted).toBe(true);
    expect(delRes.type).toBe('soft');

    // Should still exist but marked inactive and importance 0
    const db = DatabaseManager.getInstance();
    const row = db.prepare('SELECT is_active, importance FROM memory WHERE id = ?').get(id) as any;
    expect(row.is_active).toBe(0);
    expect(row.importance).toBe(0);
  });

  it('should hard delete a memory', async () => {
    const storeRes = await executeMemoryStore({ text: 'Hard delete me' });
    const id = storeRes.record.id;

    const delRes = await executeMemoryDelete({ id, hard: true });
    expect(delRes.success).toBe(true);
    expect(delRes.deleted).toBe(true);
    expect(delRes.type).toBe('hard');

    // Should not exist
    const db = DatabaseManager.getInstance();
    const row = db.prepare('SELECT * FROM memory WHERE id = ?').get(id);
    expect(row).toBeUndefined();
  });

  it('should handle non-existent memory delete', async () => {
    const delRes = await executeMemoryDelete({ id: 'fake-id', hard: true });
    expect(delRes.success).toBe(true);
    expect(delRes.deleted).toBe(false);
  });

  it('should fail if no id is provided', async () => {
    await expect(executeMemoryDelete({ id: '' })).rejects.toThrow('Invalid input: "id" is required');
  });
});
