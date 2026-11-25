import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryExport } from '../src/tools/export.js';
import { executeMemoryRelate } from '../src/tools/graph.js';
import {
  computeContentSha256,
  computeRefSourceHash,
  executeCheckRefDrift,
  extractMarkdownSection,
  resolveVaultRefPath,
} from '../src/tools/obsidian_bridge.js';
import { executeMemoryReindex } from '../src/tools/reindex.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemorySync } from '../src/tools/sync.js';

describe('Obsidian Vault Zero-Copy Ref Sync Bridge (#141)', () => {
  let tmpVault: string;
  let exportDir: string;

  beforeEach(() => {
    process.env.EMBEDDING_PROVIDER = 'none';
    tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-obsidian-vault-'));
    exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-obsidian-export-'));
  });

  afterEach(() => {
    delete process.env.EMBEDDING_PROVIDER;
    DatabaseManager.close();
    EmbeddingCache.clear();
    fs.rmSync(tmpVault, { recursive: true, force: true });
    fs.rmSync(exportDir, { recursive: true, force: true });
  });

  it('extracts Markdown sections cleanly and computes OS-independent LF SHA-256 digests', () => {
    const doc =
      '# Overview\r\nIntro.\r\n\r\n## Storage\r\nSQLite WAL mode.\r\n\r\n### Details\r\nZero Ollama.\r\n\r\n## Security\r\nLoopback only.\r\n';
    const section = extractMarkdownSection(doc, 'Storage');
    expect(section).toBe('## Storage\nSQLite WAL mode.\n\n### Details\nZero Ollama.');

    const hashLf = computeContentSha256('hello\nworld');
    const hashCrLf = computeContentSha256('hello\r\nworld');
    expect(hashLf).toBe(hashCrLf);
    expect(computeRefSourceHash(doc, 'Missing Section')).toBeNull();
  });

  it('blocks path traversal outside vaultRoot cleanly', () => {
    expect(resolveVaultRefPath(tmpVault, { vault_path: '../../etc/passwd' })).toBeNull();
    expect(resolveVaultRefPath(tmpVault, { vault_path: 'specs/auth.md' })).toBe(
      path.resolve(tmpVault, 'specs/auth.md')
    );
    expect(resolveVaultRefPath(tmpVault, { wikilink: '[[Architecture#Storage|Arch]]' })).toBe(
      path.resolve(tmpVault, 'Architecture.md')
    );
  });

  it('detects fresh, stale, missing, and unhashed zero-copy refs deterministically and supports hash refresh', async () => {
    const specDir = path.join(tmpVault, 'specs');
    fs.mkdirSync(specDir, { recursive: true });
    const specFile = path.join(specDir, 'engine.md');
    const initialContent =
      '# Engine\n\n## Retrieval\nUses SQLite FTS5 porter unicode61.\n\n## Transport\nStdio default.\n';
    fs.writeFileSync(specFile, initialContent, 'utf-8');

    const freshHash = computeRefSourceHash(initialContent, 'Retrieval') as string;
    const wholeHash = computeContentSha256(initialContent);

    const freshMem = await executeMemoryStore({
      text: 'Engine retrieval uses SQLite FTS5 porter unicode61.',
      metadata: {
        ref: {
          vault_path: 'specs/engine.md',
          wikilink: '[[specs/engine]]',
          section: 'Retrieval',
          source_hash: freshHash,
        },
      },
    });
    const staleMem = await executeMemoryStore({
      text: 'Engine spec full document pointer.',
      metadata: {
        ref: {
          vault_path: 'specs/engine.md',
          source_hash: '0000000000000000000000000000000000000000000000000000000000000000',
        },
      },
    });
    const unhashedMem = await executeMemoryStore({
      text: 'Transport defaults to stdio.',
      metadata: {
        ref: {
          vault_path: 'specs/engine.md',
          section: 'Transport',
        },
      },
    });
    const missingMem = await executeMemoryStore({
      text: 'Deleted legacy note reference.',
      metadata: {
        ref: {
          vault_path: 'specs/deleted.md',
          source_hash: wholeHash,
        },
      },
    });

    const firstCheck = executeCheckRefDrift({ vaultRoot: tmpVault });
    expect(firstCheck.summary).toMatchObject({
      total: 4,
      fresh: 1,
      stale: 1,
      missing: 1,
      unhashed: 1,
    });
    expect(firstCheck.items.find((i) => i.id === freshMem.record.id)?.status).toBe('fresh');
    expect(firstCheck.items.find((i) => i.id === staleMem.record.id)?.status).toBe('stale');
    expect(firstCheck.items.find((i) => i.id === unhashedMem.record.id)?.status).toBe('unhashed');
    expect(firstCheck.items.find((i) => i.id === missingMem.record.id)?.status).toBe('missing');

    // Mutate only the Retrieval section -> previously fresh pointer becomes stale!
    const updatedContent = initialContent.replace('porter unicode61', 'porter unicode61 + IDF');
    fs.writeFileSync(specFile, updatedContent, 'utf-8');

    const afterEdit = executeCheckRefDrift({ vaultRoot: tmpVault });
    expect(afterEdit.items.find((i) => i.id === freshMem.record.id)?.status).toBe('stale');

    // Refresh hashes deterministically -> stale + unhashed become fresh on next check
    const refreshed = executeCheckRefDrift({ vaultRoot: tmpVault, updateHashes: true });
    expect(refreshed.items.filter((i) => i.updated)).toHaveLength(3);

    const postRefresh = executeCheckRefDrift({ vaultRoot: tmpVault });
    expect(postRefresh.summary).toMatchObject({
      total: 4,
      fresh: 3,
      stale: 0,
      missing: 1,
      unhashed: 0,
    });
  });

  it('preserves external grounded_in/references wikilinks and inactive placeholders across export, sync, and reindex', async () => {
    const notePath = path.join(tmpVault, 'Architecture.md');
    const noteBody = '# Architecture\nMarkdown is canonical truth.\n';
    fs.writeFileSync(notePath, noteBody, 'utf-8');
    const hash = computeContentSha256(noteBody);

    const mem = await executeMemoryStore({
      text: 'Architecture summary grounded in Obsidian vault.',
      profile: 'agent_core',
      metadata: {
        ref: {
          vault_path: 'Architecture.md',
          wikilink: '[[Architecture]]',
          source_hash: hash,
        },
      },
    });
    await executeMemoryRelate({
      sourceId: mem.record.id,
      targetId: 'obsidian://vault/Architecture.md',
      relationType: 'grounded_in',
    });
    await executeMemoryRelate({
      sourceId: mem.record.id,
      targetId: 'vault://Architecture.md',
      relationType: 'references',
    });

    // Export -> Sync (with checkRefs) -> Reindex round-trip
    await executeMemoryExport({ vaultPath: exportDir });
    const exportedFile = fs.readdirSync(exportDir).find((f) => f.endsWith('.md')) as string;
    const exportedMd = fs.readFileSync(path.join(exportDir, exportedFile), 'utf-8');
    expect(exportedMd).toContain('ref_vault_path: "Architecture.md"');
    expect(exportedMd).toContain('ref_source_hash:');
    expect(exportedMd).toContain('obsidian://vault/Architecture.md');

    const syncRes = await executeMemorySync({
      vaultPath: exportDir,
      vaultRoot: tmpVault,
      checkRefs: true,
    });
    expect(syncRes.ref_drift?.fresh).toBe(1);
    expect(syncRes.ref_drift?.external_edges).toBe(2);
    expect(syncRes.ref_drift?.inactive_external_placeholders).toBe(2);

    // Wipe and reindex cleanly from Markdown
    const reindexRes = await executeMemoryReindex({ vaultPath: exportDir });
    expect(reindexRes.errors).toEqual([]);

    const driftAfterReindex = executeCheckRefDrift({ vaultRoot: tmpVault });
    expect(driftAfterReindex.summary).toMatchObject({
      total: 1,
      fresh: 1,
      stale: 0,
      external_edges: 2,
      inactive_external_placeholders: 2,
    });

    // Verify external URI placeholders never pollute active search
    const searchRes = await executeMemorySearch({
      query: 'Architecture Obsidian vault',
      mode: 'bm25',
      includeGraph: true,
    });
    expect(searchRes.results).toHaveLength(1);
    expect(
      searchRes.results.every(
        (r) => !r.id.startsWith('obsidian://') && !r.id.startsWith('vault://')
      )
    ).toBe(true);
    expect(searchRes.graph?.edges.filter((e) => e.is_external)).toHaveLength(2);
  });
});
