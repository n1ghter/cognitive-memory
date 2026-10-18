import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryClearAll } from '../src/tools/clear.js';
import { executeMemoryConsolidate } from '../src/tools/consolidate.js';
import { executeMemoryExport } from '../src/tools/export.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemorySync } from '../src/tools/sync.js';

// The embedding size the mocked model returns; tests switch it to simulate changing EMBEDDING_MODEL
const model = vi.hoisted(() => ({ dimension: 768 }));

vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(model.dimension).fill(0.1);
      vec[0] = text.length;
      return vec;
    }),
  },
}));

describe('Embedding dimension', () => {
  let tmpDir: string;

  beforeEach(() => {
    model.dimension = 768;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-dimension-test-'));
  });

  afterEach(() => {
    DatabaseManager.close();
    EmbeddingCache.clear();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sizes the vector table from the model on a fresh database', async () => {
    expect(DatabaseManager.getVectorDimension()).toBeNull();

    await executeMemoryStore({ text: 'Small model memory' });
    expect(DatabaseManager.getVectorDimension()).toBe(768);

    const res = await executeMemorySearch({ query: 'Small model memory', threshold: 0.0 });
    expect(res.results[0].text).toBe('Small model memory');
  });

  it('reads the dimension of a table created by older versions', () => {
    // Exact DDL older versions ran, so existing databases parse correctly
    DatabaseManager.getInstance().exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS main.vec_memory USING vec0(
        embedding float[4096]
      );
    `);
    expect(DatabaseManager.getVectorDimension()).toBe(4096);
  });

  it('rejects a model whose dimension differs from the existing table, without writing anything', async () => {
    DatabaseManager.ensureVectorTable(4096);

    await expect(executeMemoryStore({ text: 'Mismatched memory' })).rejects.toThrow(
      'Embedding dimension mismatch: this database stores 4096-dimensional vectors'
    );

    const db = DatabaseManager.getInstance();
    expect(db.prepare('SELECT COUNT(*) as c FROM memory').get()).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM embedding_cache').get()).toEqual({ c: 0 });
    expect(DatabaseManager.getVectorDimension()).toBe(4096);
  });

  it('rejects invalid dimensions', () => {
    expect(() => DatabaseManager.ensureVectorTable(0)).toThrow('Invalid embedding dimension: 0');
  });

  it('re-embeds memories at the new size via export, clear and sync', async () => {
    model.dimension = 4096;
    await executeMemoryStore({ text: 'Memory worth keeping' });
    await executeMemoryExport({ vaultPath: tmpDir });

    model.dimension = 1024;
    await expect(executeMemorySearch({ query: 'Something new' })).rejects.toThrow(
      'Embedding dimension mismatch'
    );

    await executeMemoryClearAll({ confirm: true });
    const sync = await executeMemorySync({ vaultPath: tmpDir });
    expect(sync.imported).toBe(1);
    expect(DatabaseManager.getVectorDimension()).toBe(1024);

    const res = await executeMemorySearch({ query: 'Memory worth keeping', threshold: 0.0 });
    expect(res.results[0].text).toBe('Memory worth keeping');
  });

  it('skips consolidation when nothing has been embedded yet', async () => {
    const res = await executeMemoryConsolidate();
    expect(res).toEqual({
      success: true,
      decayed_or_updated: 0,
      pruned: 0,
      status: 'No memories to consolidate',
    });
  });
});
