import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryExport } from '../src/tools/export.js';
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

describe('Memory Export', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-export-test-'));
  });

  afterEach(() => {
    DatabaseManager.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should export memories to markdown files', async () => {
    await executeMemoryStore({ text: 'Export test 1', metadata: { domain: 'Test' } });
    await executeMemoryStore({ text: 'Export test 2' });

    const expRes = await executeMemoryExport({ vaultPath: tmpDir });
    expect(expRes.success).toBe(true);
    expect(expRes.total_exported).toBeGreaterThanOrEqual(2);

    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files[0].endsWith('.md')).toBe(true);

    const content = fs.readFileSync(path.join(tmpDir, files[0]), 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('Export test');
  });

  it('should include category in frontmatter', async () => {
    await executeMemoryStore({ text: 'Category test', metadata: { type: 'project' } });

    const expRes = await executeMemoryExport({ vaultPath: tmpDir });
    expect(expRes.success).toBe(true);

    const files = fs.readdirSync(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, files[files.length - 1]), 'utf-8');
    expect(content).toContain('category: project');
  });
});
