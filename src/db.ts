import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// In-process database file path
const DB_PATH = process.env.MEMORY_DB_PATH || path.join(process.cwd(), 'memory.sqlite');

// Global database path — overridable via env var to prevent test pollution
const GLOBAL_DB_DIR =
  process.env.GLOBAL_MEMORY_DB_DIR || path.join(os.homedir(), '.cognitive-memory');
const GLOBAL_DB_PATH = path.join(GLOBAL_DB_DIR, 'global-memory.sqlite');

/**
 * Generates a random UUID.
 *
 * @returns A random UUID string.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Normalizes the record ID by splitting it into parts and removing the first part if present.
 *
 * @param id The record ID to normalize. Can be a string or an object with an 'id' property.
 * @returns The normalized record ID as a string.
 */
export function normalizeRecordId(id: any): string {
  if (typeof id === 'string') {
    const parts = id.split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : id;
  }
  if (id && typeof id === 'object' && id.id) {
    return id.id;
  }
  return String(id);
}

/**
 * A manager for the in-process database.
 */
export class DatabaseManager {
  /**
   * The singleton instance of the database.
   *
   * @private
   */
  private static instance: Database.Database | null = null;

  /**
   * Gets the singleton instance of the database.
   *
   * Creates a new database if it doesn't exist, and loads the sqlite-vec extension and enables WAL mode.
   *
   * @returns The singleton instance of the database.
   */
  public static getInstance(): Database.Database {
    if (!DatabaseManager.instance) {
      if (!fs.existsSync(GLOBAL_DB_DIR)) {
        fs.mkdirSync(GLOBAL_DB_DIR, { recursive: true });
      }

      const db = new Database(DB_PATH);

      // Load sqlite-vec extension
      sqliteVec.load(db);

      // Enable WAL mode for better concurrency
      db.pragma('journal_mode = WAL');

      // Setup schema for main DB
      DatabaseManager.initSchema(db, 'main');

      // Attach global DB
      // Note: we replace backward slashes with forward slashes for SQLite ATTACH path safely
      const safeGlobalPath = GLOBAL_DB_PATH.replace(/\\/g, '/');
      db.exec(`ATTACH DATABASE '${safeGlobalPath}' AS global;`);

      // Setup schema for global DB
      DatabaseManager.initSchema(db, 'global');

      DatabaseManager.instance = db;
    }
    return DatabaseManager.instance;
  }

  /**
   * Initializes the schema of the database.
   *
   * Creates the necessary tables and indexes for the database.
   *
   * @private
   * @param db The database to initialize the schema for.
   */
  private static initSchema(db: Database.Database, schemaName: string = 'main') {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.memory (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        metadata TEXT,
        importance REAL DEFAULT 0.5,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accessed_count INTEGER DEFAULT 0
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS ${schemaName}.vec_memory USING vec0(
        embedding float[4096]
      );


      CREATE TABLE IF NOT EXISTS ${schemaName}.edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(source_id) REFERENCES memory(id),
        FOREIGN KEY(target_id) REFERENCES memory(id)
      );

      CREATE TABLE IF NOT EXISTS ${schemaName}.sync_ledger (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        last_sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ${schemaName}.embedding_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text_hash TEXT UNIQUE NOT NULL,
        embedding BLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration for existing databases
    try {
      db.exec(`ALTER TABLE ${schemaName}.memory ADD COLUMN updated_at DATETIME`);
    } catch (_e) {
      // Column already exists or table doesn't exist yet
    }
  }

  /**
   * Closes the database and releases any system resources.
   *
   * @returns No value, but returns undefined if successful.
   */
  public static close(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.close();
      DatabaseManager.instance = null;
    }
  }
}
