export type SearchMode = 'hybrid' | 'bm25' | 'vector';
export type EmbeddingProvider = 'auto' | 'ollama' | 'none';

const STOPWORDS = new Set([
  // English common function words
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'does',
  'for',
  'from',
  'has',
  'have',
  'how',
  'i',
  'in',
  'into',
  'is',
  'it',
  'its',
  'my',
  'of',
  'on',
  'or',
  'our',
  'should',
  'so',
  'that',
  'the',
  'their',
  'this',
  'to',
  'under',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  // Russian common function words
  'в',
  'во',
  'и',
  'или',
  'к',
  'как',
  'какой',
  'каком',
  'на',
  'не',
  'но',
  'о',
  'от',
  'по',
  'при',
  'с',
  'со',
  'то',
  'у',
  'что',
  'это',
]);

/**
 * Resolves the configured embedding provider mode from environment variables.
 * - `none` / `off` / `lexical`: disables embedding requests completely (pure SQLite FTS5 BM25).
 * - `ollama`: strictly requires Ollama embeddings (throws on Ollama errors).
 * - `auto` (default): uses Ollama when reachable and falls back gracefully to FTS5 BM25 when offline.
 */
export function getEmbeddingProvider(env: NodeJS.ProcessEnv = process.env): EmbeddingProvider {
  const raw = (env.EMBEDDING_PROVIDER || 'auto').trim().toLowerCase();
  if (raw === 'none' || raw === 'off' || raw === 'lexical') {
    return 'none';
  }
  if (raw === 'ollama' || raw === 'strict') {
    return 'ollama';
  }
  return 'auto';
}

/**
 * Returns true if the error indicates an embedding vector dimension mismatch (must never be swallowed).
 */
export function isEmbeddingDimensionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Embedding dimension mismatch') ||
    message.includes('Invalid embedding dimension')
  );
}

/**
 * Extracts normalized Unicode tokens from a search query, stripping common stopwords unless all tokens are stopwords.
 */
export function tokenizeQuery(query: string): string[] {
  const rawTokens = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const uniqueRaw = [...new Set(rawTokens)];
  const filtered = uniqueRaw.filter((t) => !STOPWORDS.has(t) && t.length > 1);
  return filtered.length > 0 ? filtered : uniqueRaw;
}

/**
 * Builds a syntax-safe SQLite FTS5 MATCH expression from arbitrary natural language or code queries.
 * Uses quoted tokens with prefix expansion on longer alphabetic terms for lightweight stemming.
 */
export function buildFtsQuery(query: string): { ftsQuery: string; terms: string[] } {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) {
    return { ftsQuery: '', terms: [] };
  }

  const clauses = terms.map((term) => {
    const escaped = term.replace(/"/g, '""');
    // Enable prefix matching on 5+ char alphabetic tokens to avoid short-word false collisions (e.g. "call"* -> "calligraphy")
    if (term.length >= 5 && /^[\p{L}]+$/u.test(term)) {
      return `"${escaped}"*`;
    }
    return `"${escaped}"`;
  });

  return { ftsQuery: clauses.join(' OR '), terms };
}

/**
 * Maps SQLite FTS5 raw bm25() values (negative; more negative = stronger match) into a bounded (0, 1] score.
 */
export function normalizeBm25(rawBm25: number): number {
  const magnitude = Math.max(0, -rawBm25);
  return magnitude / (magnitude + 2.0);
}

/**
 * Computes the fraction of query terms that match tokens (exact or prefix) in the document text.
 */
export function computeTermCoverage(queryTerms: string[], docText: string): number {
  if (queryTerms.length === 0) return 0;
  const docTokens = docText.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (docTokens.length === 0) return 0;

  let matched = 0;
  for (const term of queryTerms) {
    const isPrefixEligible = term.length >= 5 && /^[\p{L}]+$/u.test(term);
    const hit = docTokens.some((dt) => (isPrefixEligible ? dt.startsWith(term) : dt === term));
    if (hit) matched++;
  }
  return matched / queryTerms.length;
}

/**
 * Determines whether a lexical FTS5 hit passes confidence gating for default thresholded retrieval,
 * preserving high negative-query abstention while remaining accurate on tiny (1-2 row) databases
 * where Okapi BM25 IDF collapses toward zero.
 */
export function isLexicalConfident(
  bm25Score: number,
  coverage: number,
  queryTermCount: number,
  threshold: number
): boolean {
  if (threshold <= 0) return true;
  if (queryTermCount <= 1) {
    return coverage >= 1;
  }
  // High term coverage passes even on 1-row corpora where BM25 IDF is near zero
  if (coverage >= 0.5) return true;
  // Partial coverage requires a meaningful BM25 signal from a larger corpus
  return (coverage >= 0.34 && bm25Score >= 0.3) || (coverage >= 0.25 && bm25Score >= 0.55);
}

export interface RrfRankEntry {
  rrfScore: number;
  bm25Rank?: number;
  vecRank?: number;
}

/**
 * Combines two ranked candidate lists using Reciprocal Rank Fusion (RRF),
 * normalized to [0, 1] relative to the maximum possible rank-1 score.
 */
export function fuseReciprocalRank(
  bm25Keys: string[],
  vecKeys: string[],
  k: number = 60,
  weights: { bm25?: number; vec?: number } = {}
): Map<string, RrfRankEntry> {
  const wBm25 = weights.bm25 ?? 1.0;
  const wVec = weights.vec ?? 1.0;

  const hasBm25 = bm25Keys.length > 0;
  const hasVec = vecKeys.length > 0;
  const maxTheoretical = ((hasBm25 ? wBm25 : 0) + (hasVec ? wVec : 0)) / (k + 1);

  const scores = new Map<string, RrfRankEntry>();

  bm25Keys.forEach((key, idx) => {
    const rank = idx + 1;
    const raw = wBm25 / (k + rank);
    scores.set(key, {
      rrfScore: maxTheoretical > 0 ? raw / maxTheoretical : 0,
      bm25Rank: rank,
    });
  });

  vecKeys.forEach((key, idx) => {
    const rank = idx + 1;
    const raw = wVec / (k + rank);
    const normalizedAdd = maxTheoretical > 0 ? raw / maxTheoretical : 0;
    const existing = scores.get(key);
    if (existing) {
      existing.rrfScore += normalizedAdd;
      existing.vecRank = rank;
    } else {
      scores.set(key, {
        rrfScore: normalizedAdd,
        vecRank: rank,
      });
    }
  });

  return scores;
}
