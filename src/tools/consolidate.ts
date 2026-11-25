import { DatabaseManager, generateId } from '../db.js';
import { OllamaClient } from '../ollama.js';
import { areLexicallyDuplicate, getEmbeddingProvider } from '../retrieval.js';
import { executeMemoryStore } from './store.js';

interface MemoryRecord {
  id: string;
  rowid: number;
  text: string;
  importance: number;
  last_accessed_at: string;
  metadata: any;
  embedding: number[] | null;
}

/**
 * Execute memory consolidation ("Auto Dream") on the database.
 *
 * Performs time-decay pruning and near-duplicate merging across active memories.
 * Works with zero external dependencies (lexical Jaccard + conflict-guarded merge)
 * and optionally upgrades synthesis via Ollama LLM when reachable.
 */
export async function executeMemoryConsolidate(): Promise<{
  success: boolean;
  decayed_or_updated: number;
  pruned: number;
  merged?: number;
  status: string;
}> {
  const db = DatabaseManager.getInstance();
  const hasVectors = DatabaseManager.getVectorDimension('main') !== null;

  const activeRecords = (
    hasVectors
      ? db
          .prepare(
            `SELECT m.id, m.rowid, m.text, m.importance, m.last_accessed_at, m.metadata, v.embedding
             FROM memory m
             LEFT JOIN main.vec_memory v ON m.rowid = v.rowid
             WHERE m.is_active = 1 AND m.valid_until IS NULL`
          )
          .all()
      : db
          .prepare(
            `SELECT m.id, m.rowid, m.text, m.importance, m.last_accessed_at, m.metadata, NULL AS embedding
             FROM memory m
             WHERE m.is_active = 1 AND m.valid_until IS NULL`
          )
          .all()
  ) as any[];

  if (activeRecords.length === 0) {
    return {
      success: true,
      decayed_or_updated: 0,
      pruned: 0,
      status: 'No memories to consolidate',
    };
  }

  console.error('activeRecords length:', activeRecords.length);

  let prunedCount = 0;
  let updatedCount = 0;
  const remainingMemories: MemoryRecord[] = [];
  const lambda = 0.004;
  const now = Date.now();

  db.transaction(() => {
    for (const mem of activeRecords) {
      const elapsedHours = Math.max(0, (now - new Date(mem.last_accessed_at).getTime()) / 3600000);
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

        let embedding: number[] | null = null;
        if (mem.embedding) {
          const floatArray = new Float32Array(
            mem.embedding.buffer,
            mem.embedding.byteOffset,
            mem.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
          );
          embedding = Array.from(floatArray);
        }

        remainingMemories.push({
          ...mem,
          metadata: parsedMetadata,
          importance: newImportance,
          embedding,
        });
      }
    }
  })();

  const mergedCount = await runBackgroundDeduplication(remainingMemories, hasVectors).catch(
    (err) => {
      console.error(err);
      return 0;
    }
  );

  return {
    success: true,
    decayed_or_updated: updatedCount,
    pruned: prunedCount,
    merged: mergedCount,
    status: 'Deduplication running in background',
  };
}

/**
 * Deterministic zero-LLM synthesis fallback: retains the richer/longer factual statement.
 */
function deterministicMergeText(a: string, b: string): string {
  const cleanA = a.trim();
  const cleanB = b.trim();
  return cleanB.length > cleanA.length ? cleanB : cleanA;
}

async function runBackgroundDeduplication(
  memories: MemoryRecord[],
  hasVectors: boolean
): Promise<number> {
  const db = DatabaseManager.getInstance();
  const provider = getEmbeddingProvider();

  let mergedCount = 0;
  const processedIds = new Set<string>();

  for (let i = 0; i < memories.length; i++) {
    if (mergedCount >= 3) break;
    const memA = memories[i];
    if (processedIds.has(memA.id)) continue;

    // 1. Gather candidate duplicates via vector cosine distance (if available) + zero-LLM lexical detector
    const candidateMap = new Map<
      string,
      { id: string; text: string; importance: number; metadata: any }
    >();

    if (hasVectors && memA.embedding) {
      const floatArray = new Float32Array(memA.embedding);
      const vectorMatches = db
        .prepare(
          `SELECT m.id, m.text, m.importance, m.metadata,
                  (1.0 - vec_distance_cosine(v.embedding, ?)) AS similarity
           FROM memory m
           JOIN main.vec_memory v ON m.rowid = v.rowid
           WHERE m.is_active = 1 AND m.valid_until IS NULL AND m.id != ?
             AND vec_distance_cosine(v.embedding, ?) <= 0.08
           ORDER BY similarity DESC`
        )
        .all(floatArray, memA.id, floatArray) as any[];
      for (const m of vectorMatches) {
        let bMeta = {};
        try {
          bMeta = JSON.parse(m.metadata);
        } catch (_e) {}
        candidateMap.set(m.id, {
          id: m.id,
          text: m.text,
          importance: m.importance,
          metadata: bMeta,
        });
      }
    }

    // Zero-LLM lexical near-duplicate scan across remaining memories
    for (let j = i + 1; j < memories.length; j++) {
      const memB = memories[j];
      if (processedIds.has(memB.id) || candidateMap.has(memB.id)) continue;
      if (areLexicallyDuplicate(memA.text, memB.text)) {
        candidateMap.set(memB.id, {
          id: memB.id,
          text: memB.text,
          importance: memB.importance,
          metadata: memB.metadata,
        });
      }
    }

    for (const memB of candidateMap.values()) {
      if (processedIds.has(memB.id)) continue;
      let mergedText: string | null = null;
      let synthesisMode: 'llm' | 'deterministic' = 'deterministic';

      if (provider !== 'none') {
        try {
          mergedText = await OllamaClient.generateText(
            `Memory 1: "${memA.text}"\nMemory 2: "${memB.text}"`,
            'You are a memory consolidation assistant. Merge the memories into one clear factual statement.'
          );
          synthesisMode = 'llm';
        } catch (err) {
          console.error('Consolidate err:', err);
          if (provider === 'ollama') {
            continue;
          }
          // Auto-Dream fallback: merge deterministically without requiring Ollama
          mergedText = deterministicMergeText(memA.text, memB.text);
        }
      } else {
        mergedText = deterministicMergeText(memA.text, memB.text);
      }

      if (!mergedText) continue;

      try {
        const storeResult = await executeMemoryStore({
          text: mergedText,
          metadata: {
            ...memA.metadata,
            ...memB.metadata,
            consolidated_from: [memA.id, memB.id],
            consolidation_mode: synthesisMode,
          },
          importance: Math.min(1.0, Math.max(memA.importance, memB.importance) + 0.1),
        });

        db.transaction(() => {
          db.prepare(
            `UPDATE memory
             SET is_active = 0, importance = 0.0, valid_until = CURRENT_TIMESTAMP, superseded_by = ?
             WHERE id IN (?, ?)`
          ).run(storeResult.record.id, memA.id, memB.id);
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

  return mergedCount;
}
