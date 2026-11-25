import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

// In-process database file path
const DB_PATH = process.env.MEMORY_DB_PATH || path.join(process.cwd(), 'memory.sqlite');

// Global database path
const GLOBAL_DB_PATH =
  process.env.MEMORY_GLOBAL_DB_PATH ||
  path.join(os.homedir(), '.cognitive-memory', 'global-memory.sqlite');

/**
 * Which memory database a tool reads from or writes to:
 * `local` is the project DB, `global` the attached user-wide DB, `all` both.
 */
export type MemoryScope = 'local' | 'global' | 'all';

/** Schema of an attached database: `main` is the project DB, `global` the user-wide DB. */
export type VectorSchema = 'main' | 'global';

/**
 * Maps a memory scope to the SQLite schema names it covers.
 *
 * @param scope The requested scope. Defaults to `local`.
 * @returns The schema names (`main` for local, `global` for global).
 */
export function scopeToSchemas(scope: MemoryScope = 'local'): VectorSchema[] {
  switch (scope) {
    case 'local':
      return ['main'];
    case 'global':
      return ['global'];
    case 'all':
      return ['main', 'global'];
    default:
      throw new Error('Invalid input: "scope" must be one of "local", "global", "all"');
  }
}

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
   * Embedding dimension already verified against each schema's vector table, so repeat checks stay cheap.
   *
   * @private
   */
  private static verifiedDimensions = new Map<VectorSchema, number>();

  /**
   * Gets the singleton instance of the database.
   *
   * Creates a new database if it doesn't exist, and loads the sqlite-vec extension and enables WAL mode.
   *
   * @returns The singleton instance of the database.
   */
  public static getInstance(): Database.Database {
    if (!DatabaseManager.instance) {
      const globalDbDir = path.dirname(GLOBAL_DB_PATH);
      if (GLOBAL_DB_PATH !== ':memory:' && !fs.existsSync(globalDbDir)) {
        fs.mkdirSync(globalDbDir, { recursive: true });
      }

      const dbDir = path.dirname(DB_PATH);
      if (DB_PATH !== ':memory:' && !fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
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

      // Older versions created a fixed-size vector table in the global DB that nothing ever wrote to.
      // Drop it while it is empty, so the first global store recreates it at the model's dimension.
      DatabaseManager.dropEmptyLegacyGlobalVectorTable(db);

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
        is_external INTEGER DEFAULT 0,
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

    // Always-on SQLite FTS5 (BM25) lexical index synchronized with memory table
    const hadFts = Boolean(
      db.prepare(`SELECT 1 FROM ${schemaName}.sqlite_master WHERE name = 'fts_memory'`).get()
    );

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${schemaName}.fts_memory USING fts5(
        text,
        content='memory',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS ${schemaName}.memory_fts_ai AFTER INSERT ON memory BEGIN
        INSERT INTO fts_memory(rowid, text) VALUES (new.rowid, new.text);
      END;

      CREATE TRIGGER IF NOT EXISTS ${schemaName}.memory_fts_ad AFTER DELETE ON memory BEGIN
        INSERT INTO fts_memory(fts_memory, rowid, text) VALUES('delete', old.rowid, old.text);
      END;

      CREATE TRIGGER IF NOT EXISTS ${schemaName}.memory_fts_au AFTER UPDATE OF text ON memory BEGIN
        INSERT INTO fts_memory(fts_memory, rowid, text) VALUES('delete', old.rowid, old.text);
        INSERT INTO fts_memory(rowid, text) VALUES (new.rowid, new.text);
      END;
    `);

    // Backfill existing pre-FTS5 databases cleanly on first startup
    if (!hadFts) {
      const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${schemaName}.memory`).get() as {
        n: number;
      };
      if (n > 0) {
        db.exec(`INSERT INTO ${schemaName}.fts_memory(fts_memory) VALUES('rebuild');`);
      }
    }

    // Migration for existing databases
    try {
      db.exec(`ALTER TABLE ${schemaName}.memory ADD COLUMN updated_at DATETIME`);
    } catch (_e) {
      // Column already exists or table doesn't exist yet
    }

    try {
      db.exec(`ALTER TABLE ${schemaName}.edges ADD COLUMN is_external INTEGER DEFAULT 0`);
    } catch (_e) {
      // Column already exists or table doesn't exist yet
    }
  }

  /**
   * Rebuilds the SQLite FTS5 lexical index from the memory table for the given schema.
   *
   * @param schema `main` for the project DB, `global` for the user-wide DB.
   */
  public static rebuildFts(schema: VectorSchema = 'main'): void {
    DatabaseManager.getInstance().exec(
      `INSERT INTO ${schema}.fts_memory(fts_memory) VALUES('rebuild');`
    );
  }

  /**
   * Reads the embedding dimension a schema's vector table was created with.
   *
   * @param schema `main` for the project DB, `global` for the user-wide DB.
   * @returns The dimension, or null if the vector table does not exist yet.
   */
  public static getVectorDimension(schema: VectorSchema = 'main'): number | null {
    const row = DatabaseManager.getInstance()
      .prepare(`SELECT sql FROM ${schema}.sqlite_master WHERE name = 'vec_memory'`)
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
   * @param schema `main` for the project DB, `global` for the user-wide DB.
   * @throws If the existing vector table was created for a different dimension.
   */
  public static ensureVectorTable(dimension: number, schema: VectorSchema = 'main'): void {
    if (DatabaseManager.verifiedDimensions.get(schema) === dimension) {
      return;
    }
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error(`Invalid embedding dimension: ${dimension}`);
    }

    const existing = DatabaseManager.getVectorDimension(schema);
    if (existing === null) {
      DatabaseManager.getInstance().exec(
        `CREATE VIRTUAL TABLE ${schema}.vec_memory USING vec0(embedding float[${dimension}])`
      );
    } else if (existing !== dimension) {
      const database = schema === 'global' ? 'the global database' : 'this database';
      throw new Error(
        `Embedding dimension mismatch: ${database} stores ${existing}-dimensional vectors, ` +
          `but the embedding model (EMBEDDING_MODEL) returned ${dimension} dimensions. ` +
          'Switch EMBEDDING_MODEL back to the model this database was built with, or re-embed your memories: ' +
          'run memory_export, then memory_clear_all, then memory_sync with the new model.'
      );
    }
    DatabaseManager.verifiedDimensions.set(schema, dimension);
  }

  /**
   * Drops a schema's vector table so the next embedding recreates it at the current model's dimension.
   *
   * @param schema `main` for the project DB, `global` for the user-wide DB.
   */
  public static dropVectorTable(schema: VectorSchema = 'main'): void {
    DatabaseManager.getInstance().exec(`DROP TABLE IF EXISTS ${schema}.vec_memory`);
    DatabaseManager.verifiedDimensions.delete(schema);
  }

  /**
   * Drops the global vector table left by older versions, but only while it holds no vectors.
   *
   * @param db The database with the global DB attached.
   */
  private static dropEmptyLegacyGlobalVectorTable(db: Database.Database): void {
    const exists = db.prepare("SELECT 1 FROM global.sqlite_master WHERE name = 'vec_memory'").get();
    if (!exists) {
      return;
    }
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM global.vec_memory').get() as { n: number };
    if (n === 0) {
      db.exec('DROP TABLE global.vec_memory');
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
    DatabaseManager.verifiedDimensions.clear();
  }
}
