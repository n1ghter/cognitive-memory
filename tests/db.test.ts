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
});
