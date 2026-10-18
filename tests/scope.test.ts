import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager, scopeToSchemas } from '../src/db.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';

// Mock Ollama so we don't need a real container
vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.1);
      vec[0] = text.length;
      return vec;
    }),
  },
}));

describe('Memory scope (local / global / all)', () => {
  afterEach(() => {
    DatabaseManager.close();
  });

  it('maps scopes to schemas and rejects unknown scopes', () => {
    expect(scopeToSchemas()).toEqual(['main']);
    expect(scopeToSchemas('local')).toEqual(['main']);
    expect(scopeToSchemas('global')).toEqual(['global']);
    expect(scopeToSchemas('all')).toEqual(['main', 'global']);
    expect(() => scopeToSchemas('nope' as any)).toThrow('Invalid input: "scope"');
  });

  it('stores into the local DB by default', async () => {
    const res = await executeMemoryStore({ text: 'Local default memory' });
    expect(res.record.scope).toBe('local');

    const db = DatabaseManager.getInstance();
    expect(db.prepare('SELECT COUNT(*) AS c FROM main.memory').get()).toEqual({ c: 1 });
    expect(db.prepare('SELECT COUNT(*) AS c FROM global.memory').get()).toEqual({ c: 0 });
  });

  it('stores into the global DB when scope is global', async () => {
    const res = await executeMemoryStore({ text: 'Global memory', scope: 'global' });
    expect(res.record.scope).toBe('global');

    const db = DatabaseManager.getInstance();
    expect(db.prepare('SELECT COUNT(*) AS c FROM main.memory').get()).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) AS c FROM global.memory').get()).toEqual({ c: 1 });
    expect(db.prepare('SELECT COUNT(*) AS c FROM global.vec_memory').get()).toEqual({ c: 1 });
  });

  it('rejects an invalid store scope', async () => {
    await expect(executeMemoryStore({ text: 'x', scope: 'all' as any })).rejects.toThrow(
      'Invalid input: "scope" must be "local" or "global"'
    );
  });

  it('searches local only by default, global only, or both', async () => {
    await executeMemoryStore({ text: 'Project fact' });
    await executeMemoryStore({ text: 'User-wide fact', scope: 'global' });

    const local = await executeMemorySearch({ query: 'fact', threshold: 0, limit: 10 });
    expect(local.results.map((r) => r.text)).toEqual(['Project fact']);
    expect(local.results[0].scope).toBe('local');

    const global = await executeMemorySearch({
      query: 'fact',
      threshold: 0,
      limit: 10,
      scope: 'global',
    });
    expect(global.results.map((r) => r.text)).toEqual(['User-wide fact']);
    expect(global.results[0].scope).toBe('global');

    const all = await executeMemorySearch({ query: 'fact', threshold: 0, limit: 10, scope: 'all' });
    expect(all.results.map((r) => r.scope).sort()).toEqual(['global', 'local']);
  });

  it('merges all-scope results by similarity and applies the limit overall', async () => {
    // Query length 8 → the closest embedding is the text with length 8
    await executeMemoryStore({ text: 'far away local memory' });
    await executeMemoryStore({ text: 'near-glb', scope: 'global' });

    const res = await executeMemorySearch({
      query: 'qqqqqqqq',
      threshold: 0,
      limit: 1,
      scope: 'all',
    });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].text).toBe('near-glb');
    expect(res.results[0].scope).toBe('global');
  });

  it('updates access stats in the DB each result came from', async () => {
    await executeMemoryStore({ text: 'Local stat' });
    await executeMemoryStore({ text: 'Global stat', scope: 'global' });

    await executeMemorySearch({ query: 'stat', threshold: 0, limit: 10, scope: 'all' });

    const db = DatabaseManager.getInstance();
    expect(db.prepare('SELECT accessed_count AS c FROM main.memory').get()).toEqual({ c: 1 });
    expect(db.prepare('SELECT accessed_count AS c FROM global.memory').get()).toEqual({ c: 1 });
  });

  it('rejects an invalid search scope', async () => {
    await expect(executeMemorySearch({ query: 'x', scope: 'nope' as any })).rejects.toThrow(
      'Invalid input: "scope"'
    );
  });
});
