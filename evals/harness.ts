import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';
import { OllamaClient } from '../src/ollama.js';
import { areLexicallyDuplicate, type SearchMode } from '../src/retrieval.js';
import { executeMemoryExport } from '../src/tools/export.js';
import { executeMemoryRelate } from '../src/tools/graph.js';
import { executeMemoryReindex } from '../src/tools/reindex.js';
import { executeMemorySearch } from '../src/tools/search.js';
import {
  executeMemoryStore,
  type MemoryProfile,
  type PointerMetadata,
} from '../src/tools/store.js';

export interface RoundTripMemoryFixture {
  key: string;
  text: string;
  profile: MemoryProfile;
  importance: number;
  metadata: PointerMetadata;
  externalLinks?: { uri: string; relationType: 'grounded_in' | 'references' }[];
  query: string;
}

export interface RoundTripDataset {
  groundedMemories: RoundTripMemoryFixture[];
  internalRelations: { sourceKey: string; targetKey: string; relationType: string }[];
  supersession: {
    oldText: string;
    newText: string;
    profile: MemoryProfile;
    query: string;
  };
}

/**
 * Golden dataset: memories to store, graded queries, dedup pairs, temporal contradiction cases,
 * and Track D Markdown <-> SQLite round-trip & grounding invariants.
 */
export interface EvalDataset {
  memories: { key: string; text: string; metadata?: PointerMetadata }[];
  queries: { query: string; relevant: string[]; category: string }[];
  dedupPairs: { a: string; b: string; duplicate: boolean }[];
  contradictions?: { oldText: string; newText: string; query: string }[];
  roundTrip?: RoundTripDataset;
}

/** Retrieval metrics averaged over a set of queries that have at least one relevant memory. */
export interface RankingScores {
  queries: number;
  recallAtK: number;
  hitAt1: number;
  mrr: number;
  ndcgAtK: number;
}

/** Track D: lossless Markdown <-> SQLite reindex & zero-copy grounding invariants. */
export interface RoundTripScores {
  totalChecks: number;
  memoriesPreservedRate: number;
  refsPreservedRate: number;
  edgesPreservedRate: number;
  externalInactiveRate: number;
  searchRecoveryRate: number;
  passRate: number;
  errors: string[];
}

export interface EvalReport {
  embedder: string;
  mode: SearchMode;
  noiseCount: number;
  k: number;
  ranking: { overall: RankingScores; byCategory: Record<string, RankingScores> };
  /** Behaviour of memory_search with its default similarity threshold, as agents see it. */
  thresholded: { recallAtK: number; precision: number; negativeAbstention: number };
  dedup: { threshold: number; precision: number; recall: number; accuracy: number };
  lexicalDedup: { precision: number; recall: number; accuracy: number };
  contradictions: { total: number; resolvedRate: number; staleLeakRate: number };
  roundTrip: RoundTripScores;
  failures: { query: string; category: string; expected: string[]; got: string[] }[];
}

export interface BaselineProfileFloors {
  overallRecallAtK: number;
  overallHitAt1: number;
  overallMrr: number;
  overallNdcgAtK: number;
  lexicalRecallAtK: number;
  lexicalHitAt1: number;
  defaultThresholdRecall: number;
  negativeAbstention: number;
  contradictionsResolvedRate: number;
  contradictionsMaxStaleLeakRate: number;
  lexicalDedupPrecision: number;
  lexicalDedupRecall: number;
  lexicalDedupAccuracy: number;
  roundTripPassRate: number;
}

export interface EvalBaselineFile {
  version: number;
  updatedAt: string;
  tolerance: number;
  profiles: Record<string, BaselineProfileFloors>;
}

export interface BaselineViolation {
  profile: string;
  metric: keyof BaselineProfileFloors;
  actual: number;
  expected: number;
  direction: 'min' | 'max';
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

/** Simulates an offline Ollama server so zero-Ollama resilience can be benchmarked directly. */
export function useOfflineEmbedder(): void {
  OllamaClient.getEmbedding = async () => {
    throw new Error('fetch failed');
  };
}

const NOISE_TOPICS = [
  'photosynthesis chlorophyll stomata sunlight glucose botany greenhouse',
  'quasar pulsar redshift nebula astrophysics telescope parallax',
  'baroque harpsichord counterpoint sonata orchestra timbre concerto',
  'stratigraphy limestone basalt tectonic subduction volcano mineral',
  'origami parchment calligraphy watercolor kiln stoneware glaze',
  'archipelago fjord glacier permafrost tundra estuary peninsula',
  'sourdough fermentation yeast kneading crust brioche pastry',
  'beekeeping pollination nectar honeycomb apiary hive meadow',
  'maritime sextant compass lighthouse keel rudder starboard',
  'archaeology amphora fresco mosaic aqueduct forum papyrus',
];

/**
 * Generates deterministic unrelated distractor notes to stress-test retrieval under realistic noise
 * (modeled after Experiment 2 in arXiv:2605.15184).
 */
export function generateNoiseMemories(count: number): { key: string; text: string }[] {
  const items: { key: string; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    const topic = NOISE_TOPICS[i % NOISE_TOPICS.length];
    items.push({
      key: `noise-${i + 1}`,
      text: `Background archive note #${i + 100}: field observation covering ${topic} batch-${i + 1}.`,
    });
  }
  return items;
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
 * Track D: Evaluates lossless Markdown <-> SQLite reindex invariants and zero-copy ref grounding.
 * Wipes the current throwaway main DB tables before seeding Track D fixtures so results are isolated.
 */
export async function runRoundTripEval(
  roundTrip?: RoundTripDataset,
  mode: SearchMode = 'hybrid'
): Promise<RoundTripScores> {
  if (!roundTrip || roundTrip.groundedMemories.length === 0) {
    return {
      totalChecks: 0,
      memoriesPreservedRate: 1,
      refsPreservedRate: 1,
      edgesPreservedRate: 1,
      externalInactiveRate: 1,
      searchRecoveryRate: 1,
      passRate: 1,
      errors: [],
    };
  }

  const db = DatabaseManager.getInstance();
  db.transaction(() => {
    db.prepare('DELETE FROM main.edges').run();
    db.prepare('DELETE FROM main.memory').run();
    db.prepare('DELETE FROM main.embedding_cache').run();
  })();
  DatabaseManager.dropVectorTable('main');
  EmbeddingCache.clear();

  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'cognitive-memory-trackd-'));
  const errors: string[] = [];

  try {
    const idByKey = new Map<string, string>();
    const expectedExternalUris: string[] = [];

    // 1. Seed grounded memories with zero-copy ref pointers + external links
    for (const fixture of roundTrip.groundedMemories) {
      const stored = await executeMemoryStore({
        text: fixture.text,
        profile: fixture.profile,
        importance: fixture.importance,
        metadata: fixture.metadata,
      });
      idByKey.set(fixture.key, stored.record.id);

      for (const ext of fixture.externalLinks ?? []) {
        await executeMemoryRelate({
          sourceId: stored.record.id,
          targetId: ext.uri,
          relationType: ext.relationType,
        });
        expectedExternalUris.push(ext.uri);
      }
    }

    // 2. Seed internal relations
    for (const rel of roundTrip.internalRelations) {
      const sourceId = idByKey.get(rel.sourceKey);
      const targetId = idByKey.get(rel.targetKey);
      if (sourceId && targetId) {
        await executeMemoryRelate({
          sourceId,
          targetId,
          relationType: rel.relationType,
        });
      }
    }

    // 3. Seed temporal supersession pair
    const oldSup = await executeMemoryStore({
      text: roundTrip.supersession.oldText,
      profile: roundTrip.supersession.profile,
      importance: 0.7,
    });
    await executeMemoryStore({
      text: roundTrip.supersession.newText,
      profile: roundTrip.supersession.profile,
      importance: 0.9,
      supersedes: oldSup.record.id,
    });

    // 4. Export to canonical Markdown (including superseded history) and reindex from scratch
    await executeMemoryExport({ vaultPath: tmpVault, includeSuperseded: true });
    const reindexRes = await executeMemoryReindex({ vaultPath: tmpVault });
    if (reindexRes.errors.length > 0) {
      errors.push(...reindexRes.errors);
    }

    const rows = db
      .prepare(
        'SELECT id, text, metadata, importance, is_active, valid_until, superseded_by FROM main.memory'
      )
      .all() as {
      id: string;
      text: string;
      metadata: string;
      importance: number;
      is_active: number;
      valid_until: string | null;
      superseded_by: string | null;
    }[];

    const findByText = (text: string) => rows.find((r) => r.text === text);

    // Check 1: Memory preservation (active grounded memories + active/superseded pair)
    const memoryChecksTotal = roundTrip.groundedMemories.length + 2;
    let memoryChecksPassed = 0;

    for (const fixture of roundTrip.groundedMemories) {
      const row = findByText(fixture.text);
      const parsedMeta = row ? JSON.parse(row.metadata || '{}') : {};
      if (
        row &&
        row.is_active === 1 &&
        row.valid_until === null &&
        parsedMeta.profile === fixture.profile
      ) {
        memoryChecksPassed++;
      } else {
        errors.push(`Track D memory missing or corrupted after reindex: ${fixture.key}`);
      }
    }

    const restoredNew = findByText(roundTrip.supersession.newText);
    const restoredOld = findByText(roundTrip.supersession.oldText);
    if (restoredNew && restoredNew.is_active === 1 && restoredNew.valid_until === null) {
      memoryChecksPassed++;
    } else {
      errors.push('Track D active superseding memory missing after reindex');
    }
    if (
      restoredOld &&
      restoredOld.is_active === 0 &&
      restoredOld.valid_until &&
      restoredOld.superseded_by
    ) {
      memoryChecksPassed++;
    } else {
      errors.push('Track D superseded historical memory state corrupted after reindex');
    }

    // Check 2: Zero-copy metadata.ref preservation
    let refChecksTotal = 0;
    let refChecksPassed = 0;
    for (const fixture of roundTrip.groundedMemories) {
      if (!fixture.metadata.ref) continue;
      refChecksTotal++;
      const row = findByText(fixture.text);
      const parsedMeta = row ? JSON.parse(row.metadata || '{}') : {};
      const ref = parsedMeta.ref;
      const expectedRef = fixture.metadata.ref;
      if (
        ref &&
        ref.vault_path === expectedRef.vault_path &&
        ref.wikilink === expectedRef.wikilink &&
        ref.source_hash === expectedRef.source_hash &&
        ref.section === expectedRef.section
      ) {
        refChecksPassed++;
      } else {
        errors.push(`Track D metadata.ref lost or mutated for ${fixture.key}`);
      }
    }

    // Check 3: Internal + external + supersedes edges preserved
    const edges = db
      .prepare(
        'SELECT source_id, target_id, relation_type, COALESCE(is_external, 0) AS is_external FROM main.edges'
      )
      .all() as {
      source_id: string;
      target_id: string;
      relation_type: string;
      is_external: number;
    }[];

    const edgeChecksTotal = roundTrip.internalRelations.length + expectedExternalUris.length + 1;
    let edgeChecksPassed = 0;

    for (const rel of roundTrip.internalRelations) {
      const srcFixture = roundTrip.groundedMemories.find((m) => m.key === rel.sourceKey);
      const tgtFixture = roundTrip.groundedMemories.find((m) => m.key === rel.targetKey);
      const srcRow = srcFixture ? findByText(srcFixture.text) : undefined;
      const tgtRow = tgtFixture ? findByText(tgtFixture.text) : undefined;
      if (
        srcRow &&
        tgtRow &&
        edges.some(
          (e) =>
            e.source_id === srcRow.id &&
            e.target_id === tgtRow.id &&
            e.relation_type === rel.relationType &&
            e.is_external === 0
        )
      ) {
        edgeChecksPassed++;
      } else {
        errors.push(
          `Track D internal edge missing after reindex: ${rel.sourceKey}->${rel.targetKey}`
        );
      }
    }

    for (const fixture of roundTrip.groundedMemories) {
      const srcRow = findByText(fixture.text);
      for (const ext of fixture.externalLinks ?? []) {
        if (
          srcRow &&
          edges.some(
            (e) =>
              e.source_id === srcRow.id &&
              e.target_id === ext.uri &&
              e.relation_type === ext.relationType &&
              e.is_external === 1
          )
        ) {
          edgeChecksPassed++;
        } else {
          errors.push(`Track D external edge missing after reindex: ${ext.uri}`);
        }
      }
    }

    if (
      restoredNew &&
      restoredOld &&
      edges.some(
        (e) =>
          e.source_id === restoredNew.id &&
          e.target_id === restoredOld.id &&
          e.relation_type === 'supersedes'
      )
    ) {
      edgeChecksPassed++;
    } else {
      errors.push('Track D supersedes edge missing after reindex');
    }

    // Check 4: External URI placeholders stay strictly is_active = 0
    const extChecksTotal = expectedExternalUris.length;
    let extChecksPassed = 0;
    for (const uri of expectedExternalUris) {
      const placeholder = rows.find((r) => r.id === uri);
      if (placeholder && placeholder.is_active === 0) {
        extChecksPassed++;
      } else {
        errors.push(`Track D external placeholder is active or missing: ${uri}`);
      }
    }

    // Check 5: Post-reindex search recovery & no stale/external leaks
    const searchChecksTotal = roundTrip.groundedMemories.length + 1;
    let searchChecksPassed = 0;
    const effectiveSearchMode: SearchMode = mode === 'vector' ? 'hybrid' : mode;

    for (const fixture of roundTrip.groundedMemories) {
      const res = await executeMemorySearch({
        query: fixture.query,
        limit: 5,
        threshold: -1,
        mode: effectiveSearchMode,
      });
      const hitTop = res.results[0]?.text === fixture.text;
      const leakedExternal = res.results.some((r) => expectedExternalUris.includes(r.id));
      if (hitTop && !leakedExternal) {
        searchChecksPassed++;
      } else {
        errors.push(`Track D search recovery failed after reindex for ${fixture.key}`);
      }
    }

    const supSearch = await executeMemorySearch({
      query: roundTrip.supersession.query,
      limit: 5,
      threshold: -1,
      mode: effectiveSearchMode,
    });
    if (
      supSearch.results[0]?.text === roundTrip.supersession.newText &&
      !supSearch.results.some((r) => r.text === roundTrip.supersession.oldText)
    ) {
      searchChecksPassed++;
    } else {
      errors.push('Track D superseded fact leaked or active replacement missed after reindex');
    }

    const memoriesPreservedRate = memoryChecksTotal ? memoryChecksPassed / memoryChecksTotal : 1;
    const refsPreservedRate = refChecksTotal ? refChecksPassed / refChecksTotal : 1;
    const edgesPreservedRate = edgeChecksTotal ? edgeChecksPassed / edgeChecksTotal : 1;
    const externalInactiveRate = extChecksTotal ? extChecksPassed / extChecksTotal : 1;
    const searchRecoveryRate = searchChecksTotal ? searchChecksPassed / searchChecksTotal : 1;
    const totalChecks =
      memoryChecksTotal + refChecksTotal + edgeChecksTotal + extChecksTotal + searchChecksTotal;
    const totalPassed =
      memoryChecksPassed +
      refChecksPassed +
      edgeChecksPassed +
      extChecksPassed +
      searchChecksPassed;

    return {
      totalChecks,
      memoriesPreservedRate,
      refsPreservedRate,
      edgesPreservedRate,
      externalInactiveRate,
      searchRecoveryRate,
      passRate: totalChecks ? totalPassed / totalChecks : 1,
      errors,
    };
  } finally {
    fs.rmSync(tmpVault, { recursive: true, force: true });
  }
}

/**
 * Maps an eval run configuration to its canonical profile key in evals/baseline.json.
 */
export function resolveBaselineProfileKey(
  embedder: string,
  mode: SearchMode,
  noiseCount: number
): string | null {
  if ((embedder === 'offline' || embedder === 'none') && noiseCount === 0) {
    return 'offline-bm25';
  }
  if (embedder === 'hash' && noiseCount === 0) {
    if (mode === 'bm25') return 'offline-bm25';
    if (mode === 'vector') return 'hash-vector';
    if (mode === 'hybrid') return 'hash-hybrid';
  }
  if (embedder === 'hash' && mode === 'hybrid' && noiseCount === 60) {
    return 'hash-hybrid-noise60';
  }
  return null;
}

/** Loads a committed evals/baseline.json file from disk. */
export function loadBaseline(
  baselinePath: string = path.join(import.meta.dirname, 'baseline.json')
): EvalBaselineFile {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as EvalBaselineFile;
}

/**
 * Deterministically validates an EvalReport against committed floor thresholds in evals/baseline.json.
 * Returns an empty array when all floors pass, or exact structured violations on regression.
 */
export function checkReportAgainstBaseline(
  report: EvalReport,
  baseline: EvalBaselineFile,
  explicitProfileKey?: string
): BaselineViolation[] {
  const profileKey =
    explicitProfileKey ??
    resolveBaselineProfileKey(report.embedder, report.mode, report.noiseCount);
  if (!profileKey) {
    throw new Error(
      `No baseline profile found for embedder=${report.embedder}, mode=${report.mode}, noise=${report.noiseCount}`
    );
  }
  const floors = baseline.profiles[profileKey];
  if (!floors) {
    throw new Error(`Baseline profile "${profileKey}" does not exist in baseline.json`);
  }

  const tol = baseline.tolerance ?? 1e-9;
  const violations: BaselineViolation[] = [];

  const checkMin = (metric: keyof BaselineProfileFloors, actual: number, expected: number) => {
    if (actual + tol < expected) {
      violations.push({ profile: profileKey, metric, actual, expected, direction: 'min' });
    }
  };
  const checkMax = (metric: keyof BaselineProfileFloors, actual: number, expected: number) => {
    if (actual - tol > expected) {
      violations.push({ profile: profileKey, metric, actual, expected, direction: 'max' });
    }
  };

  checkMin('overallRecallAtK', report.ranking.overall.recallAtK, floors.overallRecallAtK);
  checkMin('overallHitAt1', report.ranking.overall.hitAt1, floors.overallHitAt1);
  checkMin('overallMrr', report.ranking.overall.mrr, floors.overallMrr);
  checkMin('overallNdcgAtK', report.ranking.overall.ndcgAtK, floors.overallNdcgAtK);
  checkMin(
    'lexicalRecallAtK',
    report.ranking.byCategory.lexical?.recallAtK ?? 0,
    floors.lexicalRecallAtK
  );
  checkMin('lexicalHitAt1', report.ranking.byCategory.lexical?.hitAt1 ?? 0, floors.lexicalHitAt1);
  checkMin('defaultThresholdRecall', report.thresholded.recallAtK, floors.defaultThresholdRecall);
  checkMin('negativeAbstention', report.thresholded.negativeAbstention, floors.negativeAbstention);
  checkMin(
    'contradictionsResolvedRate',
    report.contradictions.resolvedRate,
    floors.contradictionsResolvedRate
  );
  checkMax(
    'contradictionsMaxStaleLeakRate',
    report.contradictions.staleLeakRate,
    floors.contradictionsMaxStaleLeakRate
  );
  checkMin('lexicalDedupPrecision', report.lexicalDedup.precision, floors.lexicalDedupPrecision);
  checkMin('lexicalDedupRecall', report.lexicalDedup.recall, floors.lexicalDedupRecall);
  checkMin('lexicalDedupAccuracy', report.lexicalDedup.accuracy, floors.lexicalDedupAccuracy);
  checkMin('roundTripPassRate', report.roundTrip.passRate, floors.roundTripPassRate);

  return violations;
}

/**
 * Stores the dataset (plus optional distractor noise) into the current database,
 * runs every query through memory_search under the selected retrieval mode, and grades the results.
 */
export async function runEvals(
  dataset: EvalDataset,
  options: {
    embedder: string;
    k?: number;
    mode?: SearchMode;
    noiseCount?: number;
    includeRoundTrip?: boolean;
  }
): Promise<EvalReport> {
  const k = options.k ?? 5;
  const mode: SearchMode = options.mode ?? 'hybrid';
  const noiseCount = options.noiseCount ?? 0;

  const keyById = new Map<string, string>();
  const allMemories: { key: string; text: string; metadata?: PointerMetadata }[] = [
    ...dataset.memories,
    ...generateNoiseMemories(noiseCount),
  ];
  for (const memory of allMemories) {
    const { record } = await executeMemoryStore({
      text: memory.text,
      metadata: memory.metadata,
    });
    keyById.set(record.id, memory.key);
  }
  const toKeys = (results: { id: string }[]) => results.map((r) => keyById.get(r.id) ?? r.id);

  const ranked = [];
  const thresholded = [];
  for (const q of dataset.queries) {
    // threshold -1 disables filtering, so this measures pure ranking quality.
    const all = await executeMemorySearch({ query: q.query, limit: k, threshold: -1, mode });
    const filtered = await executeMemorySearch({ query: q.query, limit: k, mode });
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
  if (options.embedder !== 'none' && options.embedder !== 'offline') {
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
  }

  let lexTp = 0;
  let lexFp = 0;
  let lexFn = 0;
  let lexCorrect = 0;
  for (const pair of dataset.dedupPairs) {
    const merged = areLexicallyDuplicate(pair.a, pair.b);
    if (merged && pair.duplicate) lexTp++;
    if (merged && !pair.duplicate) lexFp++;
    if (!merged && pair.duplicate) lexFn++;
    if (merged === pair.duplicate) lexCorrect++;
  }

  // Evaluate temporal supersession / contradiction resolution (Track B)
  const contradictionCases = dataset.contradictions ?? [];
  let contradictionResolved = 0;
  let staleLeaks = 0;
  for (const c of contradictionCases) {
    const oldRes = await executeMemoryStore({ text: c.oldText });
    const newRes = await executeMemoryStore({ text: c.newText, supersedes: oldRes.record.id });
    const searchRes = await executeMemorySearch({ query: c.query, limit: k, threshold: -1, mode });
    const ids = searchRes.results.map((r) => r.id);
    if (ids[0] === newRes.record.id) contradictionResolved++;
    if (ids.includes(oldRes.record.id)) staleLeaks++;
  }

  // Evaluate Markdown <-> SQLite round-trip & grounding invariants (Track D)
  const roundTrip =
    options.includeRoundTrip === false
      ? {
          totalChecks: 0,
          memoriesPreservedRate: 1,
          refsPreservedRate: 1,
          edgesPreservedRate: 1,
          externalInactiveRate: 1,
          searchRecoveryRate: 1,
          passRate: 1,
          errors: [],
        }
      : await runRoundTripEval(dataset.roundTrip, mode);

  return {
    embedder: options.embedder,
    mode,
    noiseCount,
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
      accuracy:
        options.embedder === 'none' || options.embedder === 'offline'
          ? 0
          : dataset.dedupPairs.length
            ? correct / dataset.dedupPairs.length
            : 0,
    },
    lexicalDedup: {
      precision: lexTp + lexFp ? lexTp / (lexTp + lexFp) : 0,
      recall: lexTp + lexFn ? lexTp / (lexTp + lexFn) : 0,
      accuracy: dataset.dedupPairs.length ? lexCorrect / dataset.dedupPairs.length : 0,
    },
    contradictions: {
      total: contradictionCases.length,
      resolvedRate: contradictionCases.length
        ? contradictionResolved / contradictionCases.length
        : 1,
      staleLeakRate: contradictionCases.length ? staleLeaks / contradictionCases.length : 0,
    },
    roundTrip,
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
    `Cognitive Memory evals · embedder=${report.embedder} · mode=${report.mode} · noise=${report.noiseCount} · k=${report.k}`,
    '',
    `Ranking (no threshold)    n  Recall@${report.k}   Hit@1     MRR  nDCG@${report.k}`,
    row('overall', report.ranking.overall),
    ...Object.entries(report.ranking.byCategory).map(([name, s]) => row(name, s)),
    '',
    'memory_search with default threshold',
    `  recall@${report.k} ${pct(report.thresholded.recallAtK)}   precision ${pct(report.thresholded.precision)}   negative abstention ${pct(report.thresholded.negativeAbstention)}`,
    '',
    `Consolidation dedup (vector >= ${report.dedup.threshold})`,
    `  precision ${pct(report.dedup.precision)}   recall ${pct(report.dedup.recall)}   accuracy ${pct(report.dedup.accuracy)}`,
    'Auto-Dream zero-LLM lexical dedup',
    `  precision ${pct(report.lexicalDedup.precision)}   recall ${pct(report.lexicalDedup.recall)}   accuracy ${pct(report.lexicalDedup.accuracy)}`,
    `Temporal contradictions (n=${report.contradictions.total})`,
    `  resolved@1 ${pct(report.contradictions.resolvedRate)}   stale leak ${pct(report.contradictions.staleLeakRate)}`,
    `Track D Round-Trip & Grounding (checks=${report.roundTrip.totalChecks})`,
    `  pass ${pct(report.roundTrip.passRate)}   refs ${pct(report.roundTrip.refsPreservedRate)}   edges ${pct(report.roundTrip.edgesPreservedRate)}   ext-inactive ${pct(report.roundTrip.externalInactiveRate)}`,
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

/** Formats side-by-side comparison across multiple retrieval modes. */
export function formatComparisonTable(reports: EvalReport[]): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(7);
  const lines = [
    'Mode comparison (same dataset & noise)',
    '  Mode         Recall@K   Hit@1     MRR  nDCG@K  ThreshRec  ThreshPrec  NegAbst',
  ];
  for (const r of reports) {
    lines.push(
      `  ${r.mode.padEnd(11)} ${pct(r.ranking.overall.recallAtK)} ${pct(r.ranking.overall.hitAt1)} ${pct(r.ranking.overall.mrr)} ${pct(r.ranking.overall.ndcgAtK)}    ${pct(r.thresholded.recallAtK)}     ${pct(r.thresholded.precision)}  ${pct(r.thresholded.negativeAbstention)}`
    );
  }
  return lines.join('\n');
}
