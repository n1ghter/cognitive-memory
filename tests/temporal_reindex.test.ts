import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';
import { OllamaClient } from '../src/ollama.js';
import { areLexicallyDuplicate } from '../src/retrieval.js';
import { executeMemoryConsolidate } from '../src/tools/consolidate.js';
import { executeMemoryExport } from '../src/tools/export.js';
import { executeMemoryRelate } from '../src/tools/graph.js';
import { executeMemoryReindex } from '../src/tools/reindex.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';

describe('Temporal Supersession, Bounded CTE Subgraph, Auto-Dream & Markdown Reindex', () => {
  let tmpVault: string;

  beforeEach(() => {
    process.env.EMBEDDING_PROVIDER = 'none';
    tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'cognitive-memory-v2-vault-'));
  });

  afterEach(() => {
    delete process.env.EMBEDDING_PROVIDER;
    DatabaseManager.close();
    EmbeddingCache.clear();
    vi.restoreAllMocks();
    fs.rmSync(tmpVault, { recursive: true, force: true });
  });

  it('supersedes outdated facts temporally and filters them unless includeSuperseded=true', async () => {
    const oldMem = await executeMemoryStore({
      text: 'The backend stores graph data in SurrealDB.',
      profile: 'agent_core',
    });
    const newMem = await executeMemoryStore({
      text: 'The backend migrated from SurrealDB to embedded SQLite with FTS5.',
      profile: 'agent_core',
      supersedes: oldMem.record.id,
    });

    expect(newMem.superseded_id).toBe(oldMem.record.id);

    const active = await executeMemorySearch({ query: 'SurrealDB backend graph' });
    expect(active.results.map((r) => r.id)).toEqual([newMem.record.id]);
    expect(active.results[0].valid_until).toBeNull();

    const withHistory = await executeMemorySearch({
      query: 'SurrealDB backend graph',
      includeSuperseded: true,
    });
    expect(withHistory.results.map((r) => r.id)).toContain(oldMem.record.id);
    const historical = withHistory.results.find((r) => r.id === oldMem.record.id);
    expect(historical?.valid_until).toBeTruthy();
    expect(historical?.superseded_by).toBe(newMem.record.id);
  });

  it('expands bounded 1-hop and 2-hop CTE subgraphs including external grounded_in links', async () => {
    const a = await executeMemoryStore({ text: 'OAuth refresh token mutex prevents race bugs' });
    const b = await executeMemoryStore({ text: 'Gateway auth middleware retries 401 once' });
    const c = await executeMemoryStore({ text: 'Load balancer sticky sessions disabled' });
    const d = await executeMemoryStore({ text: 'Third hop distant archive note' });

    await executeMemoryRelate({
      sourceId: a.record.id,
      targetId: b.record.id,
      relationType: 'depends_on',
    });
    await executeMemoryRelate({
      sourceId: b.record.id,
      targetId: c.record.id,
      relationType: 'related_to',
    });
    await executeMemoryRelate({
      sourceId: c.record.id,
      targetId: d.record.id,
      relationType: 'related_to',
    });
    await executeMemoryRelate({
      sourceId: a.record.id,
      targetId: 'obsidian://vault/specs/auth-mutex.md',
      relationType: 'grounded_in',
    });

    const hop1 = await executeMemorySearch({
      query: 'OAuth refresh token mutex',
      limit: 1,
      includeGraph: true,
      graphDepth: 1,
    });
    expect(hop1.graph?.depth).toBe(1);
    const hop1NeighborIds = hop1.graph?.neighbors.map((n) => n.id) ?? [];
    expect(hop1NeighborIds).toContain(b.record.id);
    expect(hop1NeighborIds).toContain('obsidian://vault/specs/auth-mutex.md');
    expect(hop1NeighborIds).not.toContain(c.record.id);

    const hop2 = await executeMemorySearch({
      query: 'OAuth refresh token mutex',
      limit: 1,
      includeGraph: true,
      graphDepth: 2,
    });
    expect(hop2.graph?.depth).toBe(2);
    const hop2NeighborIds = hop2.graph?.neighbors.map((n) => n.id) ?? [];
    expect(hop2NeighborIds).toContain(b.record.id);
    expect(hop2NeighborIds).toContain(c.record.id);
    // Depth is strictly capped at 2 hops (3rd hop node D must not leak)
    expect(hop2NeighborIds).not.toContain(d.record.id);
  });

  it('runs zero-LLM Auto-Dream consolidation and protects conflicting pairs from false merges', async () => {
    expect(
      areLexicallyDuplicate('The database uses PostgreSQL 15.', 'The database uses PostgreSQL 16.')
    ).toBe(false);
    expect(areLexicallyDuplicate('The user likes dark mode.', 'The user dislikes dark mode.')).toBe(
      false
    );
    expect(areLexicallyDuplicate('The meetup is in Berlin.', 'The meetup is in Lisbon.')).toBe(
      false
    );
    expect(
      areLexicallyDuplicate(
        'The project is licensed under Apache 2.0.',
        'The project uses the Apache 2.0 license.'
      )
    ).toBe(true);
    expect(
      areLexicallyDuplicate(
        'Replies to the owner must be in Russian.',
        'Always reply to the owner in Russian.'
      )
    ).toBe(true);
    expect(
      areLexicallyDuplicate(
        'The staging API listens on port 8080.',
        'The staging API listens on port 8443.'
      )
    ).toBe(false);
    expect(
      areLexicallyDuplicate(
        'Backups are written to vault://archive/daily.md.',
        'Backups are written to vault://archive/weekly.md.'
      )
    ).toBe(false);
    expect(
      areLexicallyDuplicate('The dashboard uses dark theme.', 'The dashboard uses light theme.')
    ).toBe(false);

    const llmSpy = vi.spyOn(OllamaClient, 'generateText');
    await executeMemoryStore({
      text: 'The project is licensed under Apache 2.0.',
      importance: 0.7,
    });
    await executeMemoryStore({
      text: 'The project uses the Apache 2.0 license.',
      importance: 0.8,
    });
    await executeMemoryStore({
      text: 'The database uses PostgreSQL 15.',
      importance: 0.7,
    });
    await executeMemoryStore({
      text: 'The database uses PostgreSQL 16.',
      importance: 0.7,
    });

    const cons = await executeMemoryConsolidate();
    expect(cons.success).toBe(true);
    expect(cons.merged).toBe(1);
    expect(llmSpy).not.toHaveBeenCalled();

    // Both PostgreSQL 15 and 16 remain distinct and active; Apache pair merged into 1 active record
    const pgSearch = await executeMemorySearch({ query: 'PostgreSQL database', limit: 5 });
    expect(pgSearch.results).toHaveLength(2);

    const licenseSearch = await executeMemorySearch({ query: 'Apache 2.0 license', limit: 5 });
    expect(licenseSearch.results).toHaveLength(1);
  });

  it('rebuilds the SQLite index losslessly from canonical Markdown files with zero Ollama', async () => {
    const oldMem = await executeMemoryStore({
      text: 'Legacy architecture used SurrealDB.',
      profile: 'agent_core',
    });
    const newMem = await executeMemoryStore({
      text: 'Current architecture uses Markdown-first storage and SQLite FTS5.',
      profile: 'agent_core',
      supersedes: oldMem.record.id,
      metadata: {
        ref: {
          vault_path: 'docs/ARCHITECTURE_V2.md',
          wikilink: '[[ARCHITECTURE_V2]]',
        },
      },
    });
    await executeMemoryRelate({
      sourceId: newMem.record.id,
      targetId: 'obsidian://vault/docs/ARCHITECTURE_V2.md',
      relationType: 'grounded_in',
    });

    // Export both active and superseded history to canonical Markdown files
    const exp = await executeMemoryExport({ vaultPath: tmpVault, includeSuperseded: true });
    expect(exp.total_exported).toBe(2);

    // Wipe SQLite completely and rebuild purely from Markdown (with zero Ollama)
    const reindexed = await executeMemoryReindex({ vaultPath: tmpVault });
    expect(reindexed.success).toBe(true);
    expect(reindexed.indexed_memories).toBe(2);
    expect(reindexed.indexed_vectors).toBe(0);
    expect(reindexed.errors).toEqual([]);

    // Active search finds ONLY the current fact + its external grounded_in edge
    const active = await executeMemorySearch({
      query: 'Markdown-first storage SQLite FTS5',
      includeGraph: true,
    });
    expect(active.results).toHaveLength(1);
    expect(active.results[0].text).toContain('Markdown-first storage');
    expect(active.results[0].metadata.profile).toBe('agent_core');
    expect(
      active.graph?.edges.some((e) => e.relation_type === 'grounded_in' && e.is_external)
    ).toBe(true);

    // Historical search still recovers the superseded record cleanly
    const hist = await executeMemorySearch({
      query: 'SurrealDB architecture',
      includeSuperseded: true,
    });
    expect(hist.results.some((r) => r.text.includes('SurrealDB') && Boolean(r.valid_until))).toBe(
      true
    );
  });

  it('rejects reindex when vault directory does not exist', async () => {
    await expect(
      executeMemoryReindex({ vaultPath: path.join(tmpVault, 'does-not-exist') })
    ).rejects.toThrow('Markdown vault directory does not exist');
  });
});
