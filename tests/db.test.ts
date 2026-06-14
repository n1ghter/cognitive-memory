import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseManager, generateId, normalizeRecordId } from '../src/db.js';

describe('DatabaseManager & Utils', () => {
  afterEach(() => {
    DatabaseManager.close();
  });

  it('should generate valid UUIDs', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(36);
  });

  it('should normalize record IDs correctly', () => {
    expect(normalizeRecordId('memory:123')).toBe('123');
    expect(normalizeRecordId('123')).toBe('123');
    expect(normalizeRecordId({ id: '456' })).toBe('456');
  });

  it('should initialize the in-memory database successfully', () => {
    const db = DatabaseManager.getInstance();
    expect(db).toBeDefined();

    // Check if tables exist
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memory'");
    const row = stmt.get();
    expect(row).toBeDefined();
  });

  it('should fallback to string representation for other types', () => {
    expect(normalizeRecordId(123)).toBe('123');
    expect(normalizeRecordId(null)).toBe('null');
  });

  it('should use MEMORY_DB_PATH from environment if set', async () => {
    const { vi } = await import('vitest');
    const path = await import('node:path');
    const fs = await import('node:fs');

    const customPath = path.join(process.cwd(), 'custom_memory.sqlite');
    process.env.MEMORY_DB_PATH = customPath;

    vi.resetModules();
    const dbModule = await import('../src/db.js');

    const db = dbModule.DatabaseManager.getInstance();
    expect(db).toBeDefined();

    dbModule.DatabaseManager.close();

    expect(fs.existsSync(customPath)).toBe(true);

    if (fs.existsSync(customPath)) {
      fs.unlinkSync(customPath);
    }

    delete process.env.MEMORY_DB_PATH;
    vi.resetModules();
  });

  it('should create GLOBAL_DB_DIR if it does not exist', async () => {
    const { vi } = await import('vitest');
    const path = await import('node:path');
    const fs = await import('node:fs');

    const tempHome = path.join(process.cwd(), 'temp_test_home');
    const tempGlobalDir = path.join(tempHome, '.cognitive-memory');

    // Cleanup before test
    if (fs.existsSync(tempGlobalDir)) fs.rmSync(tempGlobalDir, { recursive: true, force: true });
    if (fs.existsSync(tempHome)) fs.rmSync(tempHome, { recursive: true, force: true });

    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;

    vi.resetModules();
    const dbModule = await import('../src/db.js');

    const db = dbModule.DatabaseManager.getInstance();
    expect(db).toBeDefined();
    dbModule.DatabaseManager.close();

    // Verify directory was created
    expect(fs.existsSync(tempGlobalDir)).toBe(true);

    // Cleanup after test
    fs.rmSync(tempHome, { recursive: true, force: true });

    // Restore env
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    vi.resetModules();
  });
});
