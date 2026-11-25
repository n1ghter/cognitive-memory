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

const DEDUP_STOPWORDS = new Set([
  ...STOPWORDS,
  'always',
  'must',
  'over',
  'rather',
  'than',
  'use',
  'used',
  'uses',
  'using',
  'version',
  'runs',
  'prefer',
  'prefers',
  'licensed',
  'license',
]);

const NEGATION_PAIRS: [RegExp, RegExp][] = [
  [/\blikes?\b/i, /\bdislikes?\b/i],
  [/\bprefers?\b/i, /\bavoids?\b/i],
  [/\benabled?\b/i, /\bdisabled?\b/i],
  [/\ballows?\b/i, /\bforbids?\b/i],
  [/\btrue\b/i, /\bfalse\b/i],
];

const NEGATION_MARKERS = /\b(not|never|no|don't|doesn't|isn't|aren't|won't|dislikes?|forbids?)\b/i;

function stemDedupToken(token: string): string {
  if (token === 'ci') return 'ci';
  if (token.length <= 4) return token;
  return token.replace(/(ies|ing|ed|es|ly|s)$/, (s) => (s === 'ies' ? 'y' : ''));
}

function normalizeForDedup(text: string): string {
  return text
    .replace(/\bcontinuous integration\b/gi, 'ci')
    .replace(/\bnode\.js\b/gi, 'nodejs')
    .replace(/\bnode\b/gi, 'nodejs');
}

function extractNumbers(text: string): string[] {
  return [...new Set(text.match(/\d+(?:\.\d+)*/g) ?? [])].sort();
}

function extractInternalProperNouns(text: string): string[] {
  // Capture capitalized words that are NOT at index 0 (e.g. Berlin, Lisbon, PostgreSQL, Apache)
  const matches = text.slice(1).match(/\b[A-Z][a-zA-Z0-9._-]{2,}\b/g) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

/**
 * Zero-LLM lexical near-duplicate detector with strict conflict guards
 * (version numbers, opposing polarity/negation, and differing proper entities).
 */
export function areLexicallyDuplicate(a: string, b: string, threshold: number = 0.6): boolean {
  const cleanA = a.trim();
  const cleanB = b.trim();
  if (!cleanA || !cleanB) return false;
  if (cleanA.toLowerCase() === cleanB.toLowerCase()) return true;

  // Guard 1: Differing numeric values / versions (e.g. PostgreSQL 15 vs PostgreSQL 16)
  const numsA = extractNumbers(cleanA);
  const numsB = extractNumbers(cleanB);
  if (numsA.length > 0 && numsB.length > 0 && numsA.join(',') !== numsB.join(',')) {
    return false;
  }

  // Guard 2: Polarity / negation contradiction (e.g. likes vs dislikes)
  if (NEGATION_MARKERS.test(cleanA) !== NEGATION_MARKERS.test(cleanB)) {
    return false;
  }
  for (const [pos, neg] of NEGATION_PAIRS) {
    if ((pos.test(cleanA) && neg.test(cleanB)) || (neg.test(cleanA) && pos.test(cleanB))) {
      return false;
    }
  }

  // Guard 3: Conflicting proper entities (e.g. Berlin vs Lisbon)
  const normA = normalizeForDedup(cleanA);
  const normB = normalizeForDedup(cleanB);
  const nounsA = new Set(extractInternalProperNouns(normA));
  const nounsB = new Set(extractInternalProperNouns(normB));
  if (nounsA.size > 0 && nounsB.size > 0) {
    const onlyA = [...nounsA].filter((n) => !nounsB.has(n));
    const onlyB = [...nounsB].filter((n) => !nounsA.has(n));
    if (onlyA.length > 0 && onlyB.length > 0) {
      return false;
    }
  }

  const tokensA = new Set(
    (normA.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((t) => !DEDUP_STOPWORDS.has(t) && t.length > 1)
      .map(stemDedupToken)
  );
  const tokensB = new Set(
    (normB.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((t) => !DEDUP_STOPWORDS.has(t) && t.length > 1)
      .map(stemDedupToken)
  );

  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 && intersection / union >= threshold;
}
