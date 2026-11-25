import fs from 'node:fs';
import path from 'node:path';
import { EmbeddingCache } from '../cache.js';
import { DatabaseManager } from '../db.js';
import { executeMemoryImport } from './import.js';

export interface ReindexArgs {
  vaultPath?: string;
}

/**
 * Rebuilds the local SQLite derived index (memory, FTS5 BM25, edges, and optional vectors)
 * cleanly from a canonical Markdown/Obsidian directory.
 *
 * Implements the Markdown-first storage inversion: Markdown files are canonical truth,
 * while SQLite is completely disposable and rebuildable without data loss.
 */
export async function executeMemoryReindex(args: ReindexArgs = {}): Promise<{
  success: true;
  vault_path: string;
  indexed_memories: number;
  indexed_vectors: number;
  errors: string[];
}> {
  const vaultDir = args.vaultPath
    ? path.resolve(args.vaultPath)
    : path.join(process.cwd(), 'memories_export');

  if (!fs.existsSync(vaultDir)) {
    throw new Error(`Markdown vault directory does not exist: ${vaultDir}`);
  }

  const db = DatabaseManager.getInstance();

  // 1. Wipe derived local tables cleanly before rebuilding from Markdown truth
  const clearTx = db.transaction(() => {
    db.prepare('DELETE FROM main.edges').run();
    db.prepare('DELETE FROM main.memory').run();
    db.prepare('DELETE FROM main.embedding_cache').run();
  });
  clearTx();
  DatabaseManager.dropVectorTable('main');
  EmbeddingCache.clear();

  // 2. Force-import all Markdown notes & relations (works cleanly with or without Ollama)
  const importRes = await executeMemoryImport({ vaultPath: vaultDir, force: true });

  // 3. Ensure FTS5 index is completely synchronized
  DatabaseManager.rebuildFts('main');

  const vectorCount =
    DatabaseManager.getVectorDimension('main') !== null
      ? ((db.prepare('SELECT COUNT(*) AS n FROM main.vec_memory').get() as { n: number })?.n ?? 0)
      : 0;

  return {
    success: true,
    vault_path: vaultDir,
    indexed_memories: importRes.total_imported,
    indexed_vectors: vectorCount,
    errors: importRes.errors,
  };
}
