/**
 * Import necessary modules.
 */
import { DatabaseManager, generateId } from '../db.js';
import { OllamaClient } from '../ollama.js';
import { executeMemoryStore } from './store.js';

/**
 * Interface representing a memory record.
 *
 * @interface MemoryRecord
 */
interface MemoryRecord {
  /**
   * Unique identifier of the record.
   */
  id: string;
  /**
   * Rowid of the record in the database.
   */
  rowid: number;
  /**
   * Text content of the record.
   */
  text: string;
  /**
   * Importance score of the record.
   */
  importance: number;
  /**
   * Timestamp when the record was last accessed.
   */
  last_accessed_at: string;
  /**
   * Additional metadata associated with the record.
   */
  metadata: any;
  /**
   * Embedding vector representation of the record.
   */
  embedding: number[];
}

/**
 * Execute memory consolidation process on the database.
 *
 * This function prunes inactive memories, updates importance scores based on access times,
 * and performs background deduplication to merge similar memories into a single entry.
 *
 * @returns An object containing information about the success of the operation and
 *          statistics on pruned, updated, and merged records.
 */
/**
 * @async
 * @function executeMemoryConsolidate
 * @returns {Promise<{ success: boolean; decayed_or_updated: number; pruned: number; status: string }>}
 */
export async function executeMemoryConsolidate(): Promise<{
  /**
   * Whether the operation was successful.
   */
  success: boolean;
  /**
   * Number of memories that were updated or decayed (i.e., their importance score decreased).
   */
  decayed_or_updated: number;
  /**
   * Number of inactive memories that were pruned from the database.
   */
  pruned: number;
  /**
   * Status message indicating whether deduplication is running in background.
   */
  status: string;
}> {
  // Get an instance of the database manager
  const db = DatabaseManager.getInstance();

  // Retrieve active records from the database
  const activeRecords = db
    .prepare(
      'SELECT m.id, m.rowid, m.text, m.importance, m.last_accessed_at, m.metadata, v.embedding FROM memory m JOIN vec_memory v ON m.rowid = v.rowid WHERE m.is_active = 1'
    )
    .all() as any[];

  console.log('activeRecords length:', activeRecords.length);

  let prunedCount = 0;
  let updatedCount = 0;
  const remainingMemories: MemoryRecord[] = [];
  const lambda = 0.004; // Threshold for decayed importance
  const now = Date.now(); // Current timestamp

  // Perform memory consolidation in a database transaction
  db.transaction(() => {
    for (const mem of activeRecords) {
      const elapsedHours = (now - new Date(mem.last_accessed_at).getTime()) / 3600000;
      const newImportance = mem.importance * Math.exp(-lambda * elapsedHours);
      if (newImportance < 0.25) {
        db.prepare('UPDATE memory SET is_active = 0, importance = 0.0 WHERE id = ?').run(mem.id);
        prunedCount++;
      } else {
        db.prepare('UPDATE memory SET importance = ? WHERE id = ?').run(newImportance, mem.id);
        updatedCount++;
        let parsedMetadata = {};
        try {
          parsedMetadata = JSON.parse(mem.metadata);
        } catch (_e) {}
        const floatArray = new Float32Array(
          mem.embedding.buffer,
          mem.embedding.byteOffset,
          mem.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
        );
        remainingMemories.push({
          ...mem,
          metadata: parsedMetadata,
          importance: newImportance,
          embedding: Array.from(floatArray),
        });
      }
    }
  })();

  // Run background deduplication on the remaining memories
  await runBackgroundDeduplication(remainingMemories).catch((err) => console.error(err));

  return {
    success: true,
    decayed_or_updated: updatedCount,
    pruned: prunedCount,
    status: 'Deduplication running in background',
  };
}

/**
 * Run background deduplication on the given memories.
 *
 * This function merges similar memories into a single entry and updates related records
 * to reflect the consolidation process.
 *
 * @param memories Array of memory records to be processed for deduplication.
 */
/**
 * @async
 * @function runBackgroundDeduplication
 * @param {MemoryRecord[]} memories - Array of memory records to be processed for deduplication.
 * @returns {Promise<void>}
 */
async function runBackgroundDeduplication(memories: MemoryRecord[]): Promise<void> {
  // Get an instance of the database manager
  const db = DatabaseManager.getInstance();

  let mergedCount = 0;
  const processedIds = new Set<string>();

  for (let i = 0; i < memories.length; i++) {
    if (mergedCount >= 3) break;
    const memA = memories[i];
    if (processedIds.has(memA.id)) continue;

    // Calculate similarity scores between the current memory and other similar records
    const floatArray = new Float32Array(memA.embedding);
    const similarMemories = db
      .prepare(
        'SELECT m.id, m.text, m.importance, m.metadata, (1.0 - vec_distance_cosine(v.embedding, ?)) AS similarity FROM memory m JOIN vec_memory v ON m.rowid = v.rowid WHERE m.is_active = 1 AND m.id != ? AND vec_distance_cosine(v.embedding, ?) <= 0.08 ORDER BY similarity DESC'
      )
      .all(floatArray, memA.id, floatArray) as any[];

    for (const memB of similarMemories) {
      if (processedIds.has(memB.id)) continue;
      try {
        // Merge the memories into a single entry
        const mergedText = await OllamaClient.generateText(
          `Memory 1: "${memA.text}"\nMemory 2: "${memB.text}"`,
          'You are a memory consolidation assistant. Merge the memories into one clear factual statement.'
        );
        let bMeta = {};
        try {
          bMeta = JSON.parse(memB.metadata);
        } catch (_e) {}

        // Execute store function to update related records
        const storeResult = await executeMemoryStore({
          text: mergedText,
          metadata: { ...memA.metadata, ...bMeta, consolidated_from: [memA.id, memB.id] },
          importance: Math.min(1.0, Math.max(memA.importance, memB.importance) + 0.1),
        });

        // Update database records
        db.transaction(() => {
          db.prepare('UPDATE memory SET is_active = 0, importance = 0.0 WHERE id IN (?, ?)').run(
            memA.id,
            memB.id
          );
          db.prepare(
            'INSERT INTO edges (id, source_id, target_id, relation_type) VALUES (?, ?, ?, ?)'
          ).run(generateId(), storeResult.record.id, memA.id, 'consolidated_from');
          db.prepare(
            'INSERT INTO edges (id, source_id, target_id, relation_type) VALUES (?, ?, ?, ?)'
          ).run(generateId(), storeResult.record.id, memB.id, 'consolidated_from');
        })();

        processedIds.add(memA.id).add(memB.id);
        mergedCount++;
        break;
      } catch (err) {
        console.error('Consolidate err:', err);
      }
    }
  }
}
