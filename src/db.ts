import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// In-process database file path
const DB_PATH = process.env.MEMORY_DB_PATH || path.join(process.cwd(), 'memory.sqlite');

// Global database path
const GLOBAL_DB_DIR = path.join(os.homedir(), '.cognitive-memory');
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
   * Embedding dimension already verified against the vector table, so repeat checks stay cheap.
   *
   * @private
   */
  private static verifiedDimension: number | null = null;

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

      // Older versions also created a vector table in the global DB that nothing ever wrote to.
      // Drop it so unqualified vec_memory queries can't fall through to it before main's table exists.
      db.exec('DROP TABLE IF EXISTS global.vec_memory');

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
   * Reads the embedding dimension the vector table was created with.
   *
   * @returns The dimension, or null if the vector table does not exist yet.
   */
  public static getVectorDimension(): number | null {
    const row = DatabaseManager.getInstance()
      .prepare("SELECT sql FROM main.sqlite_master WHERE name = 'vec_memory'")
      .get() as { sql: string } | undefined;
    if (!row) {
      return null;
    }
    const match = /float\[(\d+)\]/.exec(row.sql);
    if (!match) {
      throw new Error(`Unrecognized vec_memory schema: ${row.sql}`);
    }
    return Number(match[1]);
  }

  /**
   * Ensures the vector table matches the dimension of the configured embedding model.
   *
   * The table is created on first use, sized to the first embedding the model returns.
   * An existing table with a different size is never altered, since its vectors would be lost.
   *
   * @param dimension Length of an embedding returned by the configured model.
   * @throws If the existing vector table was created for a different dimension.
   */
  public static ensureVectorTable(dimension: number): void {
    if (DatabaseManager.verifiedDimension === dimension) {
      return;
    }
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error(`Invalid embedding dimension: ${dimension}`);
    }

    const existing = DatabaseManager.getVectorDimension();
    if (existing === null) {
      DatabaseManager.getInstance().exec(
        `CREATE VIRTUAL TABLE main.vec_memory USING vec0(embedding float[${dimension}])`
      );
    } else if (existing !== dimension) {
      throw new Error(
        `Embedding dimension mismatch: this database stores ${existing}-dimensional vectors, ` +
          `but the embedding model (EMBEDDING_MODEL) returned ${dimension} dimensions. ` +
          'Switch EMBEDDING_MODEL back to the model this database was built with, or re-embed your memories: ' +
          'run memory_export, then memory_clear_all, then memory_sync with the new model.'
      );
    }
    DatabaseManager.verifiedDimension = dimension;
  }

  /**
   * Drops the vector table so the next embedding recreates it at the current model's dimension.
   */
  public static dropVectorTable(): void {
    DatabaseManager.getInstance().exec('DROP TABLE IF EXISTS main.vec_memory');
    DatabaseManager.verifiedDimension = null;
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
    DatabaseManager.verifiedDimension = null;
  }
}
