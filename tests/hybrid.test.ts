import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';
import { OllamaClient } from '../src/ollama.js';
import {
  buildFtsQuery,
  computeIdfWeightedCoverage,
  computePhraseProximityBoost,
  computeTermCoverage,
  extractCodeTokens,
  extractMetadataSearchText,
  fuseReciprocalRank,
  getEmbeddingProvider,
  normalizeBm25,
  porterStem,
  splitCodeIdentifier,
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

  describe('Porter stemming, code-aware tokenization, metadata weighting & IDF coverage (#148, #149)', () => {
    it('stems morphological variants deterministically and splits code identifiers cleanly', () => {
      expect(porterStem('maintains')).toBe(porterStem('maintainer'));
      expect(porterStem('replies')).toBe(porterStem('reply'));
      expect(porterStem('formatted')).toBe(porterStem('formatting'));
      expect(porterStem('dependencies')).toBe(porterStem('dependency'));
      expect(porterStem('порту')).toBe('порту');

      expect(splitCodeIdentifier('executeMemorySearch')).toEqual(['execute', 'memory', 'search']);
      expect(splitCodeIdentifier('HTTPServer')).toEqual(['http', 'server']);
      expect(splitCodeIdentifier('valid_until')).toEqual(['valid', 'until']);
      expect(splitCodeIdentifier('sqlite-vec')).toEqual(['sqlite', 'vec']);
      expect(splitCodeIdentifier('SQLite')).toEqual(['sqlite']);
      expect(splitCodeIdentifier('PostgreSQL')).toEqual(['postgresql']);

      const codeTokens = extractCodeTokens('Call executeMemorySearch with valid_until on SQLite');
      expect(codeTokens).toContain('execute');
      expect(codeTokens).toContain('memory');
      expect(codeTokens).toContain('validuntil');
      expect(codeTokens).not.toContain('sq');

      const metaText = extractMetadataSearchText({
        category: 'architecture',
        tags: ['sqlite-fts5', 'zero-ollama'],
        profile: 'agent_core',
        ref: {
          vault_path: 'docs/ARCHITECTURE_V2.md',
          wikilink: '[[ARCHITECTURE_V2]]',
          source_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          section: 'HybridRetrieval',
        },
      });
      expect(metaText).toContain('architecture');
      expect(metaText).toContain('fts5');
      expect(metaText).toContain('hybrid');
      expect(metaText).not.toContain('e3b0c44298fc1c14');
      expect(metaText).not.toContain('agent_core');
    });

    it('matches camelCase/snake_case code identifiers, morphological variants, and weighted metadata in zero-Ollama mode', async () => {
      process.env.EMBEDDING_PROVIDER = 'none';

      const codeMem = await executeMemoryStore({
        text: 'Use executeMemorySearch with includeSuperseded for audit trails.',
        metadata: { category: 'retrieval', tags: ['audit-trail', 'temporal'] },
      });
      const morphMem = await executeMemoryStore({
        text: 'Eduards is the maintainer who publishes releases.',
        metadata: { category: 'ownership', tags: ['npm-publish'] },
      });
      const metaOnlyMem = await executeMemoryStore({
        text: 'Operational handbook entry for release checklists.',
        metadata: { category: 'runbook', tags: ['canary-rollout'] },
      });
      const textMatchMem = await executeMemoryStore({
        text: 'Canary rollout requires error rate below 0.1 percent.',
        metadata: { category: 'ops' },
      });

      // Split camelCase identifier matched by natural words
      const camelHit = await executeMemorySearch({
        query: 'memory search superseded',
        mode: 'bm25',
      });
      expect(camelHit.results[0]?.id).toBe(codeMem.record.id);

      // Porter stemming matches "maintains" -> "maintainer"
      const morphHit = await executeMemorySearch({
        query: 'Who maintains releases?',
        mode: 'bm25',
      });
      expect(morphHit.results[0]?.id).toBe(morphMem.record.id);

      // Metadata tag search finds metaOnlyMem, while body text match ranks ahead (1.0 vs 0.5 column weight)
      const weightedHit = await executeMemorySearch({ query: 'canary rollout', mode: 'bm25' });
      expect(weightedHit.results.map((r) => r.id)).toEqual([
        textMatchMem.record.id,
        metaOnlyMem.record.id,
      ]);
    });

    it('boosts exact contiguous phrases and preserves adversarial negative abstention via IDF weighting', () => {
      const exactBoost = computePhraseProximityBoost(
        ['oauth', 'refresh', 'token'],
        'The OAuth refresh token mutex prevents concurrent rotation bugs.',
        'OAuth refresh token'
      );
      const scatteredBoost = computePhraseProximityBoost(
        ['oauth', 'refresh', 'token'],
        'Token errors happen when you refresh sessions outside OAuth.',
        'OAuth refresh token'
      );
      expect(exactBoost).toBeGreaterThan(scatteredBoost);

      const dfMap = new Map<string, number>([
        ['memory', 15],
        ['foam', 0],
        ['mattress', 0],
        ['sqlite', 1],
      ]);
      const advNeg = computeIdfWeightedCoverage(
        ['memory', 'foam', 'mattress'],
        'Local memory storage engine',
        dfMap,
        30
      );
      const rareTech = computeIdfWeightedCoverage(
        ['sqlite', 'memory'],
        'SQLite embedded database',
        dfMap,
        30
      );
      expect(rareTech.coverage).toBeGreaterThan(0.6);
      expect(advNeg.coverage).toBeLessThan(0.2);
    });

    it('auto-migrates legacy v2.0 unicode61 FTS5 SQLite databases to v2.1 porter schema without data loss', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-fts-migration-'));
      const mainDbPath = path.join(tmpDir, 'legacy-main.sqlite');
      const globalDbPath = path.join(tmpDir, 'legacy-global.sqlite');

      try {
        // Seed legacy v2.0 schema with single-column unicode61 FTS5 (no porter, no code_tokens/metadata_text)
        for (const [dbPath, id, text, meta] of [
          [
            mainDbPath,
            'legacy-main-1',
            'Eduards is the maintainer of executeMemorySearch.',
            JSON.stringify({ tags: ['fts-migration'] }),
          ],
          [
            globalDbPath,
            'legacy-global-1',
            'Global preference: use Biome formatter across repositories.',
            JSON.stringify({ tags: ['global-style'] }),
          ],
        ] as const) {
          const rawDb = new Database(dbPath);
          rawDb.exec(`
            CREATE TABLE memory (
              id TEXT PRIMARY KEY,
              text TEXT NOT NULL,
              metadata TEXT,
              importance REAL DEFAULT 0.5,
              is_active INTEGER DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              accessed_count INTEGER DEFAULT 0
            );
            CREATE VIRTUAL TABLE fts_memory USING fts5(
              text,
              content='memory',
              content_rowid='rowid',
              tokenize='unicode61 remove_diacritics 2'
            );
          `);
          rawDb
            .prepare(
              'INSERT INTO memory (id, text, metadata, importance, is_active) VALUES (?, ?, ?, 0.9, 1)'
            )
            .run(id, text, meta);
          rawDb.exec("INSERT INTO fts_memory(fts_memory) VALUES('rebuild');");
          rawDb.close();
        }

        const prevMain = process.env.MEMORY_DB_PATH;
        const prevGlobal = process.env.MEMORY_GLOBAL_DB_PATH;
        process.env.MEMORY_DB_PATH = mainDbPath;
        process.env.MEMORY_GLOBAL_DB_PATH = globalDbPath;
        process.env.EMBEDDING_PROVIDER = 'none';

        vi.resetModules();
        const { DatabaseManager: FreshDb } = await import('../src/db.js');
        const { executeMemorySearch: freshSearch } = await import('../src/tools/search.js');

        const db = FreshDb.getInstance();
        const mainDdl = (
          db.prepare("SELECT sql FROM main.sqlite_master WHERE name = 'fts_memory'").get() as {
            sql: string;
          }
        ).sql;
        const globalDdl = (
          db.prepare("SELECT sql FROM global.sqlite_master WHERE name = 'fts_memory'").get() as {
            sql: string;
          }
        ).sql;

        expect(mainDdl).toContain('porter unicode61');
        expect(mainDdl).toContain('code_tokens');
        expect(mainDdl).toContain('metadata_text');
        expect(globalDdl).toContain('porter unicode61');

        // Verify morphological + code-split + metadata backfill succeeded across both schemas
        const res = await freshSearch({
          query: 'maintains memory search fts migration',
          scope: 'local',
          mode: 'bm25',
        });
        expect(res.results[0]?.id).toBe('legacy-main-1');

        const globalRes = await freshSearch({
          query: 'Biome formatted global style',
          scope: 'global',
          mode: 'bm25',
        });
        expect(globalRes.results[0]?.id).toBe('legacy-global-1');

        FreshDb.close();
        process.env.MEMORY_DB_PATH = prevMain;
        process.env.MEMORY_GLOBAL_DB_PATH = prevGlobal;
        vi.resetModules();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
