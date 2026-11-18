import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DbModule = typeof import('../src/db.js');

describe('Global vector table', () => {
  let dir: string;
  let DatabaseManager: DbModule['DatabaseManager'];

  beforeEach(async () => {
    // A file-backed global DB, so a close and reopen behaves like a server restart.
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-global-'));
    process.env.MEMORY_GLOBAL_DB_PATH = path.join(dir, 'global.sqlite');
    vi.resetModules();
    ({ DatabaseManager } = await import('../src/db.js'));
  });

  afterEach(() => {
    DatabaseManager.close();
    process.env.MEMORY_GLOBAL_DB_PATH = ':memory:';
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('drops an empty legacy table so it is recreated at the model dimension', () => {
    DatabaseManager.getInstance().exec(
      'CREATE VIRTUAL TABLE global.vec_memory USING vec0(embedding float[16])'
    );
    DatabaseManager.close();

    expect(DatabaseManager.getVectorDimension('global')).toBeNull();
    DatabaseManager.ensureVectorTable(8, 'global');
    expect(DatabaseManager.getVectorDimension('global')).toBe(8);
  });

  it('keeps stored global vectors across restarts', () => {
    DatabaseManager.ensureVectorTable(4, 'global');
    DatabaseManager.getInstance()
      .prepare('INSERT INTO global.vec_memory (rowid, embedding) VALUES (?, ?)')
      .run(1n, new Float32Array([0.1, 0.2, 0.3, 0.4]));
    DatabaseManager.close();

    const db = DatabaseManager.getInstance();
    expect(DatabaseManager.getVectorDimension('global')).toBe(4);
    expect(db.prepare('SELECT COUNT(*) AS n FROM global.vec_memory').get()).toEqual({ n: 1 });
  });

  it('sizes the local and global vector tables independently', () => {
    DatabaseManager.ensureVectorTable(8, 'main');
    DatabaseManager.ensureVectorTable(4, 'global');

    expect(DatabaseManager.getVectorDimension('main')).toBe(8);
    expect(DatabaseManager.getVectorDimension('global')).toBe(4);
    expect(() => DatabaseManager.ensureVectorTable(8, 'global')).toThrow(
      'the global database stores 4-dimensional vectors'
    );
  });
});
