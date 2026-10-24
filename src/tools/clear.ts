import { EmbeddingCache } from '../cache.js';
import { DatabaseManager } from '../db.js';

export interface MemoryClearAllArgs {
  confirm: boolean;
}

export async function executeMemoryClearAll(args: MemoryClearAllArgs) {
  if (!args.confirm) {
    throw new Error('You must pass confirm: true to wipe all memories.');
  }

  const db = DatabaseManager.getInstance();

  try {
    db.exec('BEGIN TRANSACTION');

    // Clear edges first to maintain referential integrity (if pragmas enforced)
    db.prepare('DELETE FROM edges').run();

    // Drop semantic vectors; the next embedding recreates the table at the current model's dimension
    DatabaseManager.dropVectorTable();

    // Clear core memory records
    db.prepare('DELETE FROM memory').run();

    // Clear embedding cache
    db.prepare('DELETE FROM embedding_cache').run();

    db.exec('COMMIT');
    EmbeddingCache.clear();

    return {
      status: 'success',
      message:
        'NUCLEAR OPTION TRIGGERED. All memories, vectors, and graph edges have been completely wiped from the database.',
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
