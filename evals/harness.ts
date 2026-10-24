import { EmbeddingCache } from '../src/cache.js';
import { OllamaClient } from '../src/ollama.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';

/**
 * Golden dataset: memories to store, graded queries, and pairs for the dedup check.
 */
export interface EvalDataset {
  memories: { key: string; text: string }[];
  queries: { query: string; relevant: string[]; category: string }[];
  dedupPairs: { a: string; b: string; duplicate: boolean }[];
}

/** Retrieval metrics averaged over a set of queries that have at least one relevant memory. */
export interface RankingScores {
  queries: number;
  recallAtK: number;
  hitAt1: number;
  mrr: number;
  ndcgAtK: number;
}

export interface EvalReport {
  embedder: string;
  k: number;
  ranking: { overall: RankingScores; byCategory: Record<string, RankingScores> };
  /** Behaviour of memory_search with its default similarity threshold, as agents see it. */
  thresholded: { recallAtK: number; precision: number; negativeAbstention: number };
  dedup: { threshold: number; precision: number; recall: number; accuracy: number };
  failures: { query: string; category: string; expected: string[]; got: string[] }[];
}

// Mirrors the `vec_distance_cosine(...) <= 0.08` merge rule in src/tools/consolidate.ts.
const DEDUP_SIMILARITY = 0.92;
const EMBEDDING_DIMS = 4096;

const STOPWORDS = new Set(
  'a an and are as at be by can do does for from how in into is it its of on or our should so that the this to under use used uses using we what when where which who whose why will with would'.split(
    ' '
  )
);

function stem(token: string): string {
  if (token.length <= 4) return token;
  return token.replace(/(ies|ing|ed|es|ly|s)$/, (suffix) => (suffix === 'ies' ? 'y' : ''));
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic bag-of-words embedding (feature hashing), so the evals run in CI without Ollama.
 * It only captures word overlap, so paraphrase and cross-lingual scores are expected to be low.
 */
export function hashEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMS).fill(0);
  const tokens = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (t) => !STOPWORDS.has(t)
  );
  for (const token of tokens) {
    const hash = fnv1a(stem(token));
    vec[hash % EMBEDDING_DIMS] += hash & 0x80000000 ? -1 : 1;
  }
  const norm = Math.hypot(...vec) || 1;
  return vec.map((v) => v / norm);
}

/** Routes every embedding through the hash embedder instead of Ollama. */
export function useHashEmbedder(): void {
  OllamaClient.getEmbedding = async (text: string) => hashEmbedding(text);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function scoreRanking(rows: { relevant: string[]; got: string[] }[], k: number): RankingScores {
  const perQuery = rows.map(({ relevant, got }) => {
    const top = got.slice(0, k);
    const firstHit = top.findIndex((key) => relevant.includes(key));
    const dcg = top.reduce(
      (s, key, i) => s + (relevant.includes(key) ? 1 / Math.log2(i + 2) : 0),
      0
    );
    const idealHits = Math.min(relevant.length, k);
    let idcg = 0;
    for (let i = 0; i < idealHits; i++) idcg += 1 / Math.log2(i + 2);
    return {
      recall: top.filter((key) => relevant.includes(key)).length / relevant.length,
      hit1: firstHit === 0 ? 1 : 0,
      rr: firstHit >= 0 ? 1 / (firstHit + 1) : 0,
      ndcg: dcg / idcg,
    };
  });
  return {
    queries: rows.length,
    recallAtK: mean(perQuery.map((q) => q.recall)),
    hitAt1: mean(perQuery.map((q) => q.hit1)),
    mrr: mean(perQuery.map((q) => q.rr)),
    ndcgAtK: mean(perQuery.map((q) => q.ndcg)),
  };
}

/**
 * Stores the dataset into the current database (set MEMORY_DB_PATH to an empty one first),
 * runs every query through memory_search and grades the results.
 */
export async function runEvals(
  dataset: EvalDataset,
  options: { embedder: string; k?: number }
): Promise<EvalReport> {
  const k = options.k ?? 5;

  const keyById = new Map<string, string>();
  for (const memory of dataset.memories) {
    const { record } = await executeMemoryStore({ text: memory.text });
    keyById.set(record.id, memory.key);
  }
  const toKeys = (results: { id: string }[]) => results.map((r) => keyById.get(r.id) ?? r.id);

  const ranked = [];
  const thresholded = [];
  for (const q of dataset.queries) {
    // threshold -1 disables filtering, so this measures pure ranking quality.
    const all = await executeMemorySearch({ query: q.query, limit: k, threshold: -1 });
    const filtered = await executeMemorySearch({ query: q.query, limit: k });
    ranked.push({ ...q, got: toKeys(all.results) });
    thresholded.push({ ...q, got: toKeys(filtered.results) });
  }

  const positives = ranked.filter((q) => q.relevant.length > 0);
  const byCategory: Record<string, RankingScores> = {};
  for (const category of new Set(positives.map((q) => q.category))) {
    byCategory[category] = scoreRanking(
      positives.filter((q) => q.category === category),
      k
    );
  }

  const thresholdedPositives = thresholded.filter((q) => q.relevant.length > 0);
  const returned = thresholdedPositives.flatMap((q) =>
    q.got.map((key) => q.relevant.includes(key))
  );
  const negatives = thresholded.filter((q) => q.relevant.length === 0);

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let correct = 0;
  for (const pair of dataset.dedupPairs) {
    const [a, b] = await Promise.all([
      EmbeddingCache.getEmbedding(pair.a),
      EmbeddingCache.getEmbedding(pair.b),
    ]);
    const merged = cosine(a, b) >= DEDUP_SIMILARITY;
    if (merged && pair.duplicate) tp++;
    if (merged && !pair.duplicate) fp++;
    if (!merged && pair.duplicate) fn++;
    if (merged === pair.duplicate) correct++;
  }

  return {
    embedder: options.embedder,
    k,
    ranking: { overall: scoreRanking(positives, k), byCategory },
    thresholded: {
      recallAtK: scoreRanking(thresholdedPositives, k).recallAtK,
      precision: returned.length ? returned.filter(Boolean).length / returned.length : 0,
      negativeAbstention: mean(negatives.map((q) => (q.got.length === 0 ? 1 : 0))),
    },
    dedup: {
      threshold: DEDUP_SIMILARITY,
      precision: tp + fp ? tp / (tp + fp) : 0,
      recall: tp + fn ? tp / (tp + fn) : 0,
      accuracy: dataset.dedupPairs.length ? correct / dataset.dedupPairs.length : 0,
    },
    failures: positives
      .filter((q) => !q.got.slice(0, k).some((key) => q.relevant.includes(key)))
      .map((q) => ({ query: q.query, category: q.category, expected: q.relevant, got: q.got })),
  };
}

/** Renders a report as a plain-text scorecard. */
export function formatScorecard(report: EvalReport): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(7);
  const row = (name: string, s: RankingScores) =>
    `  ${name.padEnd(14)} ${String(s.queries).padStart(3)}  ${pct(s.recallAtK)} ${pct(s.hitAt1)} ${pct(s.mrr)} ${pct(s.ndcgAtK)}`;
  const lines = [
    `Cognitive Memory evals · embedder=${report.embedder} · k=${report.k}`,
    '',
    `Ranking (no threshold)    n  Recall@${report.k}   Hit@1     MRR  nDCG@${report.k}`,
    row('overall', report.ranking.overall),
    ...Object.entries(report.ranking.byCategory).map(([name, s]) => row(name, s)),
    '',
    'memory_search with default threshold',
    `  recall@${report.k} ${pct(report.thresholded.recallAtK)}   precision ${pct(report.thresholded.precision)}   negative abstention ${pct(report.thresholded.negativeAbstention)}`,
    '',
    `Consolidation dedup (similarity >= ${report.dedup.threshold})`,
    `  precision ${pct(report.dedup.precision)}   recall ${pct(report.dedup.recall)}   accuracy ${pct(report.dedup.accuracy)}`,
  ];
  if (report.failures.length) {
    lines.push('', `Misses (no relevant memory in top ${report.k}):`);
    for (const f of report.failures) {
      lines.push(
        `  [${f.category}] ${f.query}`,
        `      expected ${f.expected.join(', ')} · got ${f.got.join(', ') || '(none)'}`
      );
    }
  }
  return lines.join('\n');
}
