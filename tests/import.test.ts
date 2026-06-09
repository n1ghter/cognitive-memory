import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemoryImport } from '../src/tools/import.js';
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

describe('Memory Import', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-import-test-'));
  });

  afterEach(() => {
    DatabaseManager.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty success if dir does not exist', async () => {
    const res = await executeMemoryImport({ vaultPath: path.join(tmpDir, 'nonexistent') });
    expect(res.success).toBe(true);
    expect(res.total_imported).toBe(0);
  });

  it('should import new markdown files into sqlite', async () => {
    // Insert the target node so the FOREIGN KEY constraint is satisfied
    const db = DatabaseManager.getInstance();
    const targetId = 'memory:54321';
    db.prepare('INSERT INTO memory (id, text, metadata, importance, is_active) VALUES (?, ?, ?, ?, ?)').run(targetId, 'Target', '{}', 0.5, 1);

    const md = `---
type: agent_memory
category: semantic
importance: 0.8
---

# Semantic Memory [12345]

> This is a newly manually created note.

## Graph Relations
- ⬅️ **references** by [[Memory_54321]]

<details>
<summary>Raw Metadata</summary>
\`\`\`json
{ "manual": true }
\`\`\`
</details>`;

    fs.writeFileSync(path.join(tmpDir, 'Memory_12345.md'), md);
    const res = await executeMemoryImport({ vaultPath: tmpDir });
    
    expect(res.errors).toEqual([]);
    expect(res.success).toBe(true);
    expect(res.total_imported).toBe(1);

    const mem = db.prepare('SELECT * FROM memory WHERE id = ?').get('memory:12345') as any;
    expect(mem).toBeDefined();
    expect(mem.text).toBe('This is a newly manually created note.');
    expect(mem.importance).toBe(0.8);
    expect(JSON.parse(mem.metadata).manual).toBe(true);

    const edges = db.prepare('SELECT * FROM edges WHERE source_id = ? OR target_id = ?').all('memory:12345', 'memory:12345') as any[];
    expect(edges.length).toBe(1);
    expect(edges[0].relation_type).toBe('references');
    expect(edges[0].source_id).toBe('memory:54321');
    expect(edges[0].target_id).toBe('memory:12345');
  });

  it('should update existing memory if file is newer', async () => {
    // 1. Store a memory
    const storeRes = await executeMemoryStore({ text: 'Original text', importance: 0.5 });
    const shortId = storeRes.record.id;

    const db = DatabaseManager.getInstance();
    // Move updated_at to the past so the file appears newer
    db.prepare('UPDATE memory SET updated_at = datetime(\'now\', \'-1 day\') WHERE id = ?').run(shortId);

    // 2. Create an updated markdown file
    const md = `---
category: updated
importance: 0.9
---

# Updated Memory [${shortId}]

> Updated text from markdown.

## Graph Relations

<details>
<summary>Raw Metadata</summary>
\`\`\`json
{}
\`\`\`
</details>`;

    const filePath = path.join(tmpDir, `Memory_${shortId}.md`);
    fs.writeFileSync(filePath, md);
    
    // Ensure mtime is strictly greater
    const now = new Date();
    fs.utimesSync(filePath, now, now);

    const res = await executeMemoryImport({ vaultPath: tmpDir });
    expect(res.errors).toEqual([]);
    expect(res.total_imported).toBe(1);

    const mem = db.prepare('SELECT * FROM memory WHERE id = ?').get(shortId) as any;
    
    expect(mem.text).toBe('Updated text from markdown.');
    expect(mem.importance).toBe(0.9);
  });

  it('should skip import if file is not newer', async () => {
    // 1. Store a memory
    const storeRes = await executeMemoryStore({ text: 'Should not change' });
    const shortId = storeRes.record.id;

    const md = `---
category: semantic
importance: 0.5
---

# Memory [${shortId}]

> Attempted overwrite.

## Graph Relations
`;
    
    const filePath = path.join(tmpDir, `Memory_${shortId}.md`);
    fs.writeFileSync(filePath, md);

    // Set mtime to past
    const past = new Date(Date.now() - 10000);
    fs.utimesSync(filePath, past, past);

    const res = await executeMemoryImport({ vaultPath: tmpDir });
    expect(res.total_imported).toBe(0);

    const db = DatabaseManager.getInstance();
    const mem = db.prepare('SELECT * FROM memory WHERE id = ?').get(shortId) as any;
    expect(mem.text).toBe('Should not change');
  });

  it('should gracefully handle malformed markdown files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'Memory_broken.md'), 'just some random text without proper formatting');
    const res = await executeMemoryImport({ vaultPath: tmpDir });
    
    expect(res.errors).toEqual([]);
    
    // Should still import it best-effort, parsing as empty text or fallback
    expect(res.total_imported).toBe(1);
    
    const db = DatabaseManager.getInstance();
    const mem = db.prepare('SELECT * FROM memory WHERE id = ?').get('memory:broken') as any;
    expect(mem).toBeDefined();
    expect(mem.text).toBe('');
    expect(mem.importance).toBe(0.5);
  });
});
