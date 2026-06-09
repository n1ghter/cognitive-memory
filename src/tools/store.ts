import { EmbeddingCache } from '../cache.js';
import { DatabaseManager, generateId } from '../db.js';

/**
 * Arguments for the memory store function.
 */
interface StoreArgs {
  /**
   * The text to be stored.
   */
  text: string;
  /**
   * Optional metadata associated with the text.
   */
  metadata?: Record<string, any>;
  /**
   * Importance level of the text (default is 0.5).
   */
  importance?: number;
}

/**
 * Executes a memory store operation.
 *
 * @param args - The arguments for the function.
 * @returns A promise that resolves with an object containing a success flag and a stored record.
 */
export async function executeMemoryStore(args: StoreArgs) {
  const { text, metadata = {}, importance = 0.5 } = args;

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: "text" must be a non-empty string');
  }

  // 1. Retrieve the vector embedding
  const embedding = await EmbeddingCache.getEmbedding(text);

  // 2. Obtain database instance
  const db = DatabaseManager.getInstance();

  // 3. Generate UUID for record
  const id = generateId();

  // 4. Run transaction to ensure atomicity between metadata and vector tables
  const storeTx = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO memory (id, text, metadata, importance, is_active, created_at, last_accessed_at, accessed_count)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
    `);
    const info = stmt.run(id, text, JSON.stringify(metadata), importance, 1);

    // lastInsertRowid is often a BigInt in better-sqlite3. Pass it as BigInt
    // for sqlite-vec compatibility to avoid "Only integers are allows for primary key values"
    const rowid = BigInt(info.lastInsertRowid);

    const vecStmt = db.prepare(`
      INSERT INTO vec_memory (rowid, embedding)
      VALUES (?, ?)
    `);

    // sqlite-vec requires Float32Array
    const floatArray = new Float32Array(embedding);
    vecStmt.run(rowid, floatArray);

    return id;
  });

  storeTx();

  return {
    success: true,
    message: 'Memory stored successfully',
    record: {
      id: id,
      text: text,
      metadata: metadata,
      importance: importance,
      is_active: true,
    },
  };
}
