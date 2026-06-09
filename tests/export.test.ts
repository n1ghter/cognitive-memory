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

  it('should create the export directory if it does not exist', async () => {
    const newDir = path.join(tmpDir, 'new_export_folder');
    await executeMemoryStore({ text: 'Dir test' });
    const expRes = await executeMemoryExport({ vaultPath: newDir });
    expect(expRes.success).toBe(true);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it('should include graph relations in the exported file', async () => {
    // We insert directly to db since store/relate tools might be complex to mock
    // Actually, we can use the db manager.
    const db = DatabaseManager.getInstance();
    
    // Create two dummy memories via store
    const res1 = await executeMemoryStore({ text: 'Source Node' });
    const res2 = await executeMemoryStore({ text: 'Target Node' });

    const sourceId = res1.record.id;
    const targetId = res2.record.id;

    // Manually add an edge
    const { generateId } = await import('../src/db.js');
    const insertEdge = db.prepare(
      'INSERT INTO edges (id, source_id, target_id, relation_type) VALUES (?, ?, ?, ?)'
    );
    insertEdge.run(generateId(), sourceId, targetId, 'references');

    const expRes = await executeMemoryExport({ vaultPath: tmpDir });
    expect(expRes.success).toBe(true);

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    const sourceFile = files.find(f => f.includes((sourceId as string).split(':')[1] || sourceId));
    const targetFile = files.find(f => f.includes((targetId as string).split(':')[1] || targetId));

    const sourceContent = fs.readFileSync(path.join(tmpDir, sourceFile!), 'utf-8');
    const targetContent = fs.readFileSync(path.join(tmpDir, targetFile!), 'utf-8');

    expect(sourceContent).toContain('**references** ➡️ [[Memory_');
    expect(targetContent).toContain('⬅️ **references** by [[Memory_');
  });

  it('should include category in frontmatter', async () => {
    await executeMemoryStore({ text: 'Category test', metadata: { type: 'project' } });

    const expRes = await executeMemoryExport({ vaultPath: tmpDir });
    expect(expRes.success).toBe(true);

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    const content = fs.readFileSync(path.join(tmpDir, files[files.length - 1]), 'utf-8');
    expect(content).toContain('category: project');
  });
});
