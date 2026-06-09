import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemorySync } from '../src/tools/sync.js';
import { executeMemoryStore } from '../src/tools/store.js';

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
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    expect(files.length).toBe(2);
  });
});
