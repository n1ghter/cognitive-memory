import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';
import { OllamaClient } from '../src/ollama.js';
import {
  buildFtsQuery,
  computeTermCoverage,
  fuseReciprocalRank,
  getEmbeddingProvider,
  normalizeBm25,
  tokenizeQuery,
} from '../src/retrieval.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';

describe('Zero-Ollama FTS5 BM25 & Hybrid RRF Retrieval', () => {
  afterEach(() => {
    delete process.env.EMBEDDING_PROVIDER;
    DatabaseManager.close();
    EmbeddingCache.clear();
    vi.restoreAllMocks();
  });

  describe('retrieval helpers', () => {
    it('resolves EMBEDDING_PROVIDER modes cleanly', () => {
      expect(getEmbeddingProvider({})).toBe('auto');
      expect(getEmbeddingProvider({ EMBEDDING_PROVIDER: 'none' })).toBe('none');
      expect(getEmbeddingProvider({ EMBEDDING_PROVIDER: 'lexical' })).toBe('none');
      expect(getEmbeddingProvider({ EMBEDDING_PROVIDER: 'ollama' })).toBe('ollama');
    });

    it('builds syntax-safe FTS5 queries even with punctuation, symbols, and Cyrillic', () => {
      const { ftsQuery, terms } = buildFtsQuery(
        'What happens to tsconfig.tsbuildinfo after tsc -b?'
      );
      expect(terms).toContain('tsconfig');
      expect(terms).toContain('tsbuildinfo');
      expect(terms).toContain('tsc');
      expect(ftsQuery).not.toContain('?');
      expect(ftsQuery).not.toContain('-');

      const ru = buildFtsQuery('На каком порту слушает Ollama: 11434?');
      expect(ru.terms).toContain('ollama');
      expect(ru.terms).toContain('11434');
      expect(ru.ftsQuery).toContain('"11434"');

      expect(buildFtsQuery('??? --- !!!').ftsQuery).toBe('');
      expect(tokenizeQuery('the and of').length).toBeGreaterThan(0);
    });

    it('normalizes BM25 and computes term coverage and RRF scores monotonically', () => {
      expect(normalizeBm25(-5)).toBeGreaterThan(normalizeBm25(-1));
      expect(normalizeBm25(0)).toBe(0);
      expect(computeTermCoverage(['sqlite', 'fts5'], 'SQLite FTS5 BM25 index')).toBe(1);
      expect(computeTermCoverage(['sqlite', 'redis'], 'SQLite FTS5 BM25 index')).toBe(0.5);

      const fused = fuseReciprocalRank(['a', 'b', 'c'], ['b', 'a', 'd']);
      expect(fused.get('a')?.rrfScore).toBeGreaterThan(fused.get('c')?.rrfScore ?? 0);
      expect(fused.get('b')?.rrfScore).toBeGreaterThan(fused.get('d')?.rrfScore ?? 0);
    });
  });

  it('stores and searches seamlessly when Ollama is completely offline (auto fallback)', async () => {
    vi.spyOn(OllamaClient, 'getEmbedding').mockRejectedValue(new Error('fetch failed'));

    const stored = await executeMemoryStore({
      text: 'OAuth refresh token mutex prevents concurrent rotation race conditions',
      profile: 'agent_core',
    });
    expect(stored.success).toBe(true);
    expect(stored.indexed_vectors).toBe(false);

    const search = await executeMemorySearch({
      query: 'OAuth refresh token race',
      profile: 'agent_core',
    });
    expect(search.success).toBe(true);
    expect(search.retrieval_mode).toBe('bm25_fallback');
    expect(search.results).toHaveLength(1);
    expect(search.results[0].text).toContain('OAuth refresh token mutex');
    expect(search.results[0].bm25_score).toBeGreaterThan(0);
  });

  it('never calls Ollama when EMBEDDING_PROVIDER=none or mode=bm25', async () => {
    const embedSpy = vi.spyOn(OllamaClient, 'getEmbedding');
    process.env.EMBEDDING_PROVIDER = 'none';

    await executeMemoryStore({
      text: 'Global convention: use pnpm verify before merging any PR',
      scope: 'global',
    });
    await executeMemoryStore({
      text: 'Local project uses SQLite FTS5 for zero-dependency search',
      scope: 'local',
    });

    const res = await executeMemorySearch({
      query: 'pnpm verify SQLite FTS5',
      scope: 'all',
      mode: 'bm25',
      limit: 5,
    });

    expect(embedSpy).not.toHaveBeenCalled();
    expect(res.retrieval_mode).toBe('bm25');
    expect(res.results).toHaveLength(2);
    expect(res.results.map((r) => r.scope).sort()).toEqual(['global', 'local']);
  });

  it('throws when EMBEDDING_PROVIDER=ollama (strict mode) and Ollama is unreachable', async () => {
    process.env.EMBEDDING_PROVIDER = 'ollama';
    vi.spyOn(OllamaClient, 'getEmbedding').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(executeMemoryStore({ text: 'Strict mode test' })).rejects.toThrow('ECONNREFUSED');
  });

  it('backfills FTS5 cleanly via DatabaseManager.rebuildFts', async () => {
    process.env.EMBEDDING_PROVIDER = 'none';
    const db = DatabaseManager.getInstance();
    db.prepare(`
      INSERT INTO memory (id, text, metadata, importance, is_active)
      VALUES ('manual-1', 'Manual legacy row for FTS rebuild', '{}', 0.8, 1)
    `).run();

    DatabaseManager.rebuildFts('main');
    const res = await executeMemorySearch({ query: 'legacy FTS rebuild', mode: 'bm25' });
    expect(res.results.some((r) => r.id === 'manual-1')).toBe(true);
  });
});
