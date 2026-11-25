import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import {
  parseClaudeCodeMemory,
  parseCursorRules,
  parseImportToolArgs,
  runImportTool,
} from '../src/cli/import_tool.js';
import { DatabaseManager } from '../src/db.js';
import { executeCheckRefDrift } from '../src/tools/obsidian_bridge.js';
import { executeMemorySearch } from '../src/tools/search.js';

describe('Cross-Tool Deterministic Importers: Claude Code & Cursor (#142)', () => {
  let tmpDir: string;

  beforeEach(() => {
    process.env.EMBEDDING_PROVIDER = 'none';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-import-tool-'));
  });

  afterEach(() => {
    delete process.env.EMBEDDING_PROVIDER;
    DatabaseManager.close();
    EmbeddingCache.clear();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses CLI flags cleanly and rejects invalid sources', () => {
    expect(
      parseImportToolArgs([
        '--source',
        'claude-code',
        '--path',
        '/tmp/mem',
        '--dry-run',
        '--scope=global',
        '--profile=user',
      ])
    ).toEqual({
      source: 'claude-code',
      targetPath: '/tmp/mem',
      dryRun: true,
      scope: 'global',
      profile: 'user',
    });

    expect(() => parseImportToolArgs(['--source=unknown'])).toThrow('Missing or invalid --source');
  });

  it('deterministically imports Claude Code MEMORY.md and linked topic files with zero duplicates on re-run', async () => {
    const memDir = path.join(tmpDir, 'claude-memory');
    fs.mkdirSync(memDir, { recursive: true });

    fs.writeFileSync(
      path.join(memDir, 'MEMORY.md'),
      `# Project Memory

## Build Conventions
- Always run pnpm verify before merging pull requests.
- Never commit generated tsconfig.tsbuildinfo files.

## Topics
- [Database Notes](db-notes.md)
`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(memDir, 'db-notes.md'),
      `---
type: feedback
---

## SQLite Storage
- Enable WAL journal mode for concurrent local IDE access.
`,
      'utf-8'
    );

    // Dry run parses cleanly without writing to SQLite
    const dryRes = await runImportTool({
      source: 'claude-code',
      targetPath: memDir,
      cwd: tmpDir,
      dryRun: true,
    });
    expect(dryRes.dry_run).toBe(true);
    expect(dryRes.total_parsed).toBe(3);
    expect(dryRes.imported).toBe(0);

    const dbBefore = DatabaseManager.getInstance()
      .prepare('SELECT COUNT(*) AS n FROM memory')
      .get() as { n: number };
    expect(dbBefore.n).toBe(0);

    // First real import inserts all 3 entries with zero-copy ref pointers
    const firstRun = await runImportTool({
      source: 'claude-code',
      targetPath: memDir,
      cwd: tmpDir,
    });
    expect(firstRun.imported).toBe(3);
    expect(firstRun.skipped_duplicates).toBe(0);

    // Second run is strictly idempotent: 0 new imports, 3 skipped duplicates
    const secondRun = await runImportTool({
      source: 'claude-code',
      targetPath: memDir,
      cwd: tmpDir,
    });
    expect(secondRun.imported).toBe(0);
    expect(secondRun.skipped_duplicates).toBe(3);

    // Imported facts are immediately searchable offline and grounded via fresh SHA-256 refs
    const searchRes = await executeMemorySearch({ query: 'WAL journal mode IDE', mode: 'bm25' });
    expect(searchRes.results[0]?.text).toContain('WAL journal mode');
    expect(searchRes.results[0]?.metadata.source).toBe('claude-code');
    expect(searchRes.results[0]?.metadata.ref.vault_path).toBe('claude-memory/db-notes.md');

    const drift = executeCheckRefDrift({ vaultRoot: tmpDir });
    expect(drift.summary.total).toBe(3);
    expect(drift.summary.fresh).toBe(3);
  });

  it('deterministically imports Cursor .cursor/rules/*.mdc and .cursorrules idempotently', async () => {
    const rulesDir = path.join(tmpDir, '.cursor', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });

    fs.writeFileSync(
      path.join(rulesDir, 'typescript.mdc'),
      `---
description: TypeScript Strictness
globs: src/**/*.ts, tests/**/*.ts
alwaysApply: true
---

# TypeScript Standards
- Keep stdio stdout reserved strictly for JSON-RPC frames; log diagnostics to stderr.
- Validate external metadata payloads with Zod schemas before persistence.
`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.cursorrules'),
      '- Use Biome for linting and formatting across the repository.\n',
      'utf-8'
    );

    const parsed = parseCursorRules(tmpDir, { baseDir: tmpDir });
    expect(parsed).toHaveLength(3);
    expect(parsed[0].profile).toBe('agent_core');
    expect(parsed[0].importance).toBe(0.85);
    expect(parsed[0].metadata.ref?.vault_path).toBe('.cursor/rules/typescript.mdc');
    expect(parsed[0].metadata.ref?.source_hash).toHaveLength(64);

    const run1 = await runImportTool({
      source: 'cursor',
      targetPath: tmpDir,
      cwd: tmpDir,
    });
    expect(run1.imported).toBe(3);
    expect(run1.skipped_duplicates).toBe(0);

    const run2 = await runImportTool({
      source: 'cursor',
      targetPath: tmpDir,
      cwd: tmpDir,
    });
    expect(run2.imported).toBe(0);
    expect(run2.skipped_duplicates).toBe(3);

    const searchRes = await executeMemorySearch({
      query: 'Zod schemas persistence',
      profile: 'agent_core',
      mode: 'bm25',
    });
    expect(searchRes.results[0]?.text).toContain('Validate external metadata payloads with Zod');
    expect(searchRes.results[0]?.metadata.source).toBe('cursor');
  });

  it('throws clear errors when source paths do not exist', () => {
    expect(() => parseClaudeCodeMemory(path.join(tmpDir, 'nope'))).toThrow(
      'Claude Code memory path does not exist'
    );
    expect(() => parseCursorRules(path.join(tmpDir, 'nope'))).toThrow(
      'Cursor rules path does not exist'
    );
  });
});
