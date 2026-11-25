import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';

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
      importance: 0.8,
    });

    expect(storeResult.success).toBe(true);
    expect(storeResult.record).toBeDefined();
    expect(storeResult.record?.text).toBe('Hello test database');

    const searchResult = await executeMemorySearch({
      query: 'Hello test',
      limit: 1,
      threshold: 0.0,
    });

    expect(searchResult.success).toBe(true);
    expect(searchResult.results.length).toBeGreaterThan(0);
    expect(searchResult.results[0].text).toBe('Hello test database');
  });

  it('should throw an error if query is empty or invalid', async () => {
    await expect(executeMemorySearch({ query: '' })).rejects.toThrow(
      'Invalid input: "query" must be a non-empty string'
    );
    await expect(executeMemorySearch({ query: null as any })).rejects.toThrow(
      'Invalid input: "query" must be a non-empty string'
    );
  });

  it('should throw an error if store text is empty or invalid', async () => {
    await expect(executeMemoryStore({ text: '' })).rejects.toThrow(
      'Invalid input: "text" must be a non-empty string'
    );
    await expect(executeMemoryStore({ text: null as any })).rejects.toThrow(
      'Invalid input: "text" must be a non-empty string'
    );
  });

  it('should fallback to string metadata if JSON parse fails', async () => {
    const db = DatabaseManager.getInstance();
    DatabaseManager.ensureVectorTable(4096);
    // Directly insert invalid JSON metadata
    db.prepare(`
      INSERT INTO memory (id, text, metadata, importance, is_active, created_at, last_accessed_at, accessed_count)
      VALUES ('mem-bad-json', 'Search me bad JSON', '{bad json}', 0.8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
    `).run();
    db.prepare(`
      INSERT INTO vec_memory (rowid, embedding)
      VALUES (last_insert_rowid(), ?)
    `).run(new Float32Array(4096).fill(0.1));

    const res = await executeMemorySearch({ query: 'bad json search', threshold: 0.0, limit: 10 });
    expect(res.results.some((r) => r.metadata === '{bad json}')).toBe(true);
  });

  it('should log error if updating access stats fails', async () => {
    // We already stored 'TypeScript memory'
    const db = DatabaseManager.getInstance();
    await executeMemoryStore({ text: 'TypeScript' });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock db.prepare to throw error only for the update statment
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (/UPDATE\s+\S*memory\s+SET\s+last_accessed_at/i.test(sql)) {
        throw new Error('Fake DB update error');
      }
      return originalPrepare(sql);
    });

    const res = await executeMemorySearch({ query: 'TypeScript' });
    expect(res.results.length).toBeGreaterThan(0);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should throw error on critical search failure', async () => {
    const db = DatabaseManager.getInstance();

    vi.spyOn(db, 'prepare').mockImplementation(() => {
      throw new Error('Fake critical search error');
    });

    await expect(executeMemorySearch({ query: 'Break' })).rejects.toThrow(
      'Fake critical search error'
    );

    vi.restoreAllMocks();
  });

  it('should deduplicate exact content and update existing record without mutating input metadata', async () => {
    const inputMeta = { tag: 'initial' };
    const res1 = await executeMemoryStore({
      text: 'Identical memory content for deduplication',
      importance: 0.4,
      metadata: inputMeta,
    });
    expect(res1.success).toBe(true);
    expect((inputMeta as any).profile).toBeUndefined();

    const res2 = await executeMemoryStore({
      text: 'Identical memory content for deduplication',
      importance: 0.9,
      metadata: { updated: true },
    });
    expect(res2.success).toBe(true);
    expect(res2.message).toContain('idempotent match');
    expect(res2.record.id).toBe(res1.record.id);
    expect(res2.record.importance).toBe(0.9);
    expect(res2.record.metadata.tag).toBe('initial');
    expect(res2.record.metadata.updated).toBe(true);
  });

  it('should store and validate zero-copy pointer metadata', async () => {
    const pointerRes = await executeMemoryStore({
      text: 'Summary of strategic decision',
      metadata: {
        ref: {
          vault_path: 'specs/zero-copy-linking/requirements.md',
          wikilink: '[[requirements#REQ-01]]',
          source_hash: 'a1b2c3d4e5f6',
          section: 'REQ-01',
        },
        topic: 'strategy',
      },
    });

    expect(pointerRes.success).toBe(true);
    expect(pointerRes.record.metadata?.ref?.vault_path).toBe(
      'specs/zero-copy-linking/requirements.md'
    );
    expect(pointerRes.record.metadata?.ref?.wikilink).toBe('[[requirements#REQ-01]]');
  });

  it('should reject invalid metadata schema for ref pointer', async () => {
    await expect(
      executeMemoryStore({
        text: 'Bad ref pointer test',
        metadata: { ref: 'not-an-object' as any },
      })
    ).rejects.toThrow('Invalid metadata schema');
  });
});
