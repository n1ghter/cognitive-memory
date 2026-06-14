import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryStore } from '../src/tools/store.js';
import { executeMemorySync } from '../src/tools/sync.js';

vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.1);
      vec[0] = text.length;
      return vec;
    }),
  },
}));

describe('Memory Sync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sync-test-'));
  });

  afterEach(() => {
    DatabaseManager.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should sync bidirectionally', async () => {
    // 1. Store a memory in DB
    await executeMemoryStore({ text: 'From SQLite' });

    // 2. Create a memory in Obsidian
    const md = `---
category: semantic
importance: 0.5
---

# Memory [from-obsidian]

> From Obsidian

## Graph Relations
`;
    fs.writeFileSync(path.join(tmpDir, 'Memory_from-obsidian.md'), md);

    // 3. Sync
    const res = await executeMemorySync({ vaultPath: tmpDir });
    expect(res.success).toBe(true);
    expect(res.imported).toBe(1); // 'from-obsidian'
    expect(res.exported).toBe(1); // Only 'From SQLite' needs export, 'from-obsidian' is skipped

    // Verify DB has both
    const db = DatabaseManager.getInstance();
    const rows = db.prepare('SELECT id FROM memory').all() as any[];
    expect(rows.length).toBe(2);

    // Verify disk has both
    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBe(2);
  });

  it('should propagate agent deletions to disk', async () => {
    // 1. Store a memory in DB
    const resStore = await executeMemoryStore({ text: 'To be deleted' });
    const id = resStore.record.id;

    // 2. Sync to create the file on disk
    await executeMemorySync({ vaultPath: tmpDir });
    let files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    expect(files.length).toBe(1);

    // 3. Agent deletes the memory
    const { executeMemoryDelete } = await import('../src/tools/delete.js');
    await executeMemoryDelete({ id });

    // 4. Sync again. The file should be deleted from disk by import.ts!
    await executeMemorySync({ vaultPath: tmpDir });
    files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    expect(files.length).toBe(0);
  });
});
