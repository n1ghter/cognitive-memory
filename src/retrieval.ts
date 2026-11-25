export type SearchMode = 'hybrid' | 'bm25' | 'vector';
export type EmbeddingProvider = 'auto' | 'ollama' | 'none';

const STOPWORDS = new Set([
  // English common function words
  'a',
  'about',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'away',
  'be',
  'been',
  'being',
  'by',
  'can',
  'did',
  'do',
  'does',
  'done',
  'down',
  'for',
  'from',
  'had',
  'has',
  'have',
  'here',
  'how',
  'i',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'more',
  'most',
  'my',
  'of',
  'off',
  'on',
  'or',
  'our',
  'out',
  'over',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'then',
  'there',
  'this',
  'through',
  'to',
  'under',
  'up',
  'very',
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

// ============================================================================
// Deterministic Porter (1980) English Stemmer — aligned with SQLite FTS5 porter
// ============================================================================

const CONSONANT = '[^aeiou]';
const VOWEL = '[aeiouy]';
const C_SEQ = `${CONSONANT}[^aeiouy]*`;
const V_SEQ = `${VOWEL}[aeiou]*`;
const M_GT_0 = new RegExp(`^(${C_SEQ})?${V_SEQ}${C_SEQ}`);
const M_EQ_1 = new RegExp(`^(${C_SEQ})?${V_SEQ}${C_SEQ}(${V_SEQ})?$`);
const M_GT_1 = new RegExp(`^(${C_SEQ})?${V_SEQ}${C_SEQ}${V_SEQ}${C_SEQ}`);
const HAS_VOWEL = new RegExp(`^(${C_SEQ})?${VOWEL}`);
const ENDS_CVC = new RegExp(`^${C_SEQ}${VOWEL}[^aeiouwxy]$`);

const STEP2_MAP: Record<string, string> = {
  ational: 'ate',
  tional: 'tion',
  enci: 'ence',
  anci: 'ance',
  izer: 'ize',
  bli: 'ble',
  alli: 'al',
  entli: 'ent',
  eli: 'e',
  ousli: 'ous',
  ization: 'ize',
  ation: 'ate',
  ator: 'ate',
  alism: 'al',
  iveness: 'ive',
  fulness: 'ful',
  ousness: 'ous',
  aliti: 'al',
  iviti: 'ive',
  biliti: 'ble',
  logi: 'log',
};

const STEP3_MAP: Record<string, string> = {
  icate: 'ic',
  ative: '',
  alize: 'al',
  iciti: 'ic',
  ical: 'ic',
  ful: '',
  ness: '',
};

const STEP2_RE =
  /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
const STEP3_RE = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
const STEP4_RE =
  /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
const STEP4_ION_RE = /^(.+?)(s|t)(ion)$/;

/**
 * Deterministic Porter (1980) stemmer for English ASCII tokens (>= 3 chars).
 * Non-ASCII tokens (e.g. Cyrillic) and short tokens are returned lowercased untouched.
 */
export function porterStem(input: string): string {
  let w = input.toLowerCase();
  if (w.length < 3 || !/^[a-z]+$/.test(w)) {
    return w;
  }

  let firstIsY = false;
  if (w.startsWith('y')) {
    firstIsY = true;
    w = `Y${w.slice(1)}`;
  }

  // Step 1a
  if (/^.+?(ss|i)es$/.test(w)) {
    w = w.replace(/^(.+?)(ss|i)es$/, '$1$2');
  } else if (/^.+?[^s]s$/.test(w)) {
    w = w.replace(/^(.+?)([^s])s$/, '$1$2');
  }

  // Step 1b
  const eedMatch = /^(.+?)eed$/.exec(w);
  if (eedMatch) {
    if (M_GT_0.test(eedMatch[1])) {
      w = w.slice(0, -1);
    }
  } else {
    const edIngMatch = /^(.+?)(ed|ing)$/.exec(w);
    if (edIngMatch && HAS_VOWEL.test(edIngMatch[1])) {
      w = edIngMatch[1];
      if (/(at|bl|iz)$/.test(w)) {
        w += 'e';
      } else if (/([^aeiouylsz])\1$/.test(w)) {
        w = w.slice(0, -1);
      } else if (ENDS_CVC.test(w)) {
        w += 'e';
      }
    }
  }

  // Step 1c
  const yMatch = /^(.+?)y$/.exec(w);
  if (yMatch && HAS_VOWEL.test(yMatch[1])) {
    w = `${yMatch[1]}i`;
  }

  // Step 2
  const s2 = STEP2_RE.exec(w);
  if (s2 && M_GT_0.test(s2[1])) {
    w = s2[1] + STEP2_MAP[s2[2]];
  }

  // Step 3
  const s3 = STEP3_RE.exec(w);
  if (s3 && M_GT_0.test(s3[1])) {
    w = s3[1] + STEP3_MAP[s3[2]];
  }

  // Step 4
  const s4 = STEP4_RE.exec(w);
  if (s4) {
    if (M_GT_1.test(s4[1])) {
      w = s4[1];
    }
  } else {
    const s4Ion = STEP4_ION_RE.exec(w);
    if (s4Ion) {
      const stem = s4Ion[1] + s4Ion[2];
      if (M_GT_1.test(stem)) {
        w = stem;
      }
    }
  }

  // Step 5a
  const eMatch = /^(.+?)e$/.exec(w);
  if (eMatch) {
    const stem = eMatch[1];
    if (M_GT_1.test(stem) || (M_EQ_1.test(stem) && !ENDS_CVC.test(stem))) {
      w = stem;
    }
  }

  // Step 5b
  if (/ll$/.test(w) && M_GT_1.test(w)) {
    w = w.slice(0, -1);
  }

  if (firstIsY) {
    w = `y${w.slice(1)}`;
  }

  return w;
}

// ============================================================================
// Code-Aware Tokenization & Metadata Text Extraction
// ============================================================================

const COMPOUND_IDENT_RE =
  /[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)+|[\p{L}\p{N}]*[a-z\d][A-Z][\p{L}\p{N}]*|[A-Z]{3,}[A-Z][a-z][\p{L}\p{N}]*/gu;

const PROTECTED_BRAND_WORDS = new Set([
  'postgresql',
  'javascript',
  'typescript',
  'sqlite',
  'github',
  'openai',
]);

/**
 * Splits a single code identifier (`camelCase`, `PascalCase`, `snake_case`, `kebab-case`,
 * dotted paths, or `ACRONYMWord`) into lowercase constituent subtokens.
 * Preserves brand compounds like `SQLite`, `PostgreSQL`, `TypeScript` as unsplit single tokens.
 */
export function splitCodeIdentifier(rawToken: string): string[] {
  const lower = rawToken.toLowerCase();
  if (PROTECTED_BRAND_WORDS.has(lower)) {
    return [lower];
  }

  // 1. Split on structural code separators (_ - .)
  const sepParts = rawToken.split(/[._-]+/).filter(Boolean);
  const subtokens: string[] = [];

  for (const part of sepParts) {
    const partLower = part.toLowerCase();
    if (PROTECTED_BRAND_WORDS.has(partLower)) {
      subtokens.push(partLower);
      continue;
    }
    // 2. Split ACRONYMWord (prefix >= 3 caps before Capital+lowercase, so "SQLite" is never split into "SQ Lite")
    //    and camelCase ([a-z\d][A-Z])
    const expanded = part
      .replace(/([A-Z]{3,})([A-Z][a-z]{2,})/g, '$1 $2')
      .replace(/([a-z\d])([A-Z])/g, '$1 $2');
    for (const seg of expanded.split(/\s+/)) {
      const clean = seg.toLowerCase();
      if (clean.length > 0) {
        subtokens.push(clean);
      }
    }
  }

  return [...new Set(subtokens)];
}

/**
 * Extracts expanded code identifier subtokens from a document for the secondary FTS5 `code_tokens` column.
 * Only emits tokens derived from compound identifiers (`camelCase`, `PascalCase`, `snake_case`,
 * `kebab-case`, dotted paths) so normal prose term frequencies are not artificially inflated.
 */
export function extractCodeTokens(text: string): string {
  if (!text) return '';
  const matches = text.match(COMPOUND_IDENT_RE) ?? [];
  const tokens = new Set<string>();

  for (const raw of matches) {
    const lower = raw.toLowerCase();
    if (PROTECTED_BRAND_WORDS.has(lower)) continue;

    const parts = splitCodeIdentifier(raw);
    if (parts.length < 2) continue;

    // Include constituent words (length >= 2)
    for (const part of parts) {
      if (part.length >= 2) {
        tokens.add(part);
      }
    }
    // Include separator-collapsed joined token (e.g. `sqlite-vec` -> `sqlitevec`, `valid_until` -> `validuntil`)
    if (/[._-]/.test(raw)) {
      const joined = raw.replace(/[._-]+/g, '').toLowerCase();
      if (joined.length >= 3) {
        tokens.add(joined);
      }
    }
  }

  return [...tokens].join(' ');
}

const SKIP_METADATA_KEYS = new Set([
  'profile',
  'is_external',
  'source_hash',
  'consolidated_from',
  'consolidation_mode',
  'uri',
]);

const HEX_HASH_OR_UUID_RE =
  /^(?:[0-9a-f]{32,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Deterministically extracts searchable structured values (tags, category, domain, topic,
 * ref.wikilink, ref.section, ref.vault_path) from memory metadata into the weighted FTS5 `metadata_text` column.
 */
export function extractMetadataSearchText(
  metadataInput: string | Record<string, unknown> | null | undefined
): string {
  if (!metadataInput) return '';
  let parsed: Record<string, unknown>;
  if (typeof metadataInput === 'string') {
    try {
      const obj = JSON.parse(metadataInput);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
      parsed = obj as Record<string, unknown>;
    } catch {
      return '';
    }
  } else if (typeof metadataInput === 'object' && !Array.isArray(metadataInput)) {
    parsed = metadataInput;
  } else {
    return '';
  }

  const collected: string[] = [];

  const pushString = (val: string) => {
    const cleaned = val
      .replace(/\[\[|\]\]/g, '')
      .replace(/[\\/]+/g, ' ')
      .replace(/\.md$/i, '')
      .trim();
    if (!cleaned || HEX_HASH_OR_UUID_RE.test(cleaned)) return;
    collected.push(cleaned);
    const codeExtra = extractCodeTokens(cleaned);
    if (codeExtra) collected.push(codeExtra);
  };

  for (const [key, value] of Object.entries(parsed)) {
    if (SKIP_METADATA_KEYS.has(key) || value === null || value === undefined) continue;

    if (typeof value === 'string') {
      pushString(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') pushString(item);
      }
    } else if (key === 'ref' && typeof value === 'object') {
      const refObj = value as Record<string, unknown>;
      for (const refKey of ['wikilink', 'section', 'vault_path']) {
        const refVal = refObj[refKey];
        if (typeof refVal === 'string') pushString(refVal);
      }
    }
  }

  return collected.join(' ').trim();
}

// ============================================================================
// Provider & Error Helpers
// ============================================================================

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

// ============================================================================
// Query Tokenization, FTS5 Query Building, IDF Coverage & Confidence Gating
// ============================================================================

/**
 * Extracts normalized Unicode & code-aware tokens from a search query, preserving exact
 * identifiers alongside split `camelCase`/`PascalCase`/`snake_case`/`kebab-case` parts.
 */
export function tokenizeQuery(query: string): string[] {
  const rawWords = query.match(/[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*/gu) ?? [];
  const expanded: string[] = [];

  for (const raw of rawWords) {
    const parts = splitCodeIdentifier(raw);
    const hasSeparator = /[._-]/.test(raw);
    const lower = raw.toLowerCase();

    if (hasSeparator) {
      // For dotted/hyphenated/snake tokens (e.g. tsconfig.tsbuildinfo, sqlite-vec, valid_until),
      // emit constituent parts so FTS5 & coverage align cleanly with unicode61 separator rules.
      for (const p of parts) {
        expanded.push(p);
      }
    } else if (parts.length >= 2) {
      // For camelCase/PascalCase/ACRONYMWord (e.g. executeMemorySearch), preserve exact token + parts
      expanded.push(lower);
      for (const p of parts) {
        expanded.push(p);
      }
    } else {
      expanded.push(lower);
    }
  }

  const uniqueRaw = [...new Set(expanded)];
  const filtered = uniqueRaw.filter((t) => !STOPWORDS.has(t) && t.length > 1);
  return filtered.length > 0 ? filtered : uniqueRaw;
}

/**
 * Formats a single normalized token into a syntax-safe SQLite FTS5 MATCH clause.
 * Uses prefix expansion on 5+ char alphabetic tokens so Porter stems also match
 * longer derivational variants (e.g. "formatted"* -> "format"* matches "formatter").
 */
export function formatFtsTermClause(term: string): string {
  const escaped = term.replace(/"/g, '""');
  if (term.length >= 5 && /^[\p{L}]+$/u.test(term)) {
    return `"${escaped}"*`;
  }
  return `"${escaped}"`;
}

/**
 * Builds a syntax-safe SQLite FTS5 MATCH expression from arbitrary natural language or code queries.
 */
export function buildFtsQuery(query: string): { ftsQuery: string; terms: string[] } {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) {
    return { ftsQuery: '', terms: [] };
  }

  const clauses = terms.map(formatFtsTermClause);
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
 * Computes BM25-style smoothed IDF weight for a term given its corpus document frequency `df`
 * and total active document count `totalDocs`.
 * Rare technical discriminators and OOV terms receive high weight; ubiquitous corpus terms receive low weight.
 */
export function computeIdfWeight(df: number, totalDocs: number): number {
  const n = Math.max(1, totalDocs);
  const safeDf = Math.max(0, Math.min(df, n));
  return Math.log(1 + (n - safeDf + 0.5) / (safeDf + 0.5));
}

function buildStemmedDocTokens(
  docText: string,
  metadataText?: string
): {
  exact: Set<string>;
  stems: string[];
} {
  const combined = [docText, extractCodeTokens(docText), metadataText ?? '']
    .filter(Boolean)
    .join(' ');
  const rawTokens = combined.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const exact = new Set<string>(rawTokens);
  const stemSet = new Set<string>();
  for (const t of rawTokens) {
    stemSet.add(porterStem(t));
  }
  return { exact, stems: [...stemSet] };
}

function termMatchesDoc(term: string, doc: { exact: Set<string>; stems: string[] }): boolean {
  if (doc.exact.has(term)) return true;
  const stemmedTerm = porterStem(term);
  const isPrefixEligible = term.length >= 5 && /^[\p{L}]+$/u.test(term);
  for (const docStem of doc.stems) {
    if (docStem === stemmedTerm) return true;
    if (isPrefixEligible && stemmedTerm.length >= 4 && docStem.startsWith(stemmedTerm)) {
      return true;
    }
  }
  return false;
}

/**
 * Computes the fraction of query terms that match tokens (exact, Porter-stemmed, or prefix)
 * in the document text and optional extracted metadata.
 */
export function computeTermCoverage(
  queryTerms: string[],
  docText: string,
  metadataText?: string
): number {
  if (queryTerms.length === 0) return 0;
  const doc = buildStemmedDocTokens(docText, metadataText);
  if (doc.exact.size === 0) return 0;

  let matched = 0;
  for (const term of queryTerms) {
    if (termMatchesDoc(term, doc)) matched++;
  }
  return matched / queryTerms.length;
}

export interface IdfCoverageResult {
  /** IDF-weighted fraction of query terms present in the document [0, 1]. */
  coverage: number;
  /** Uniform fraction of query terms present in the document [0, 1]. */
  uniformCoverage: number;
  /** Number of distinct query terms matched. */
  matchedCount: number;
  /** Highest IDF weight among the matched query terms (0 if none matched). */
  maxMatchedIdf: number;
}

/**
 * Computes IDF-weighted term coverage so rare technical discriminators (e.g. `WAL`, `sqlite-vec`,
 * `pnpm`, `tsconfig`) outweigh ubiquitous corpus boilerplate (e.g. `memory`, `project`, `user`).
 */
export function computeIdfWeightedCoverage(
  queryTerms: string[],
  docText: string,
  termDocFreqs: ReadonlyMap<string, number>,
  totalDocs: number,
  metadataText?: string
): IdfCoverageResult {
  if (queryTerms.length === 0) {
    return { coverage: 0, uniformCoverage: 0, matchedCount: 0, maxMatchedIdf: 0 };
  }
  const doc = buildStemmedDocTokens(docText, metadataText);
  if (doc.exact.size === 0) {
    return { coverage: 0, uniformCoverage: 0, matchedCount: 0, maxMatchedIdf: 0 };
  }

  let matchedWeight = 0;
  let totalWeight = 0;
  let matchedCount = 0;
  let maxMatchedIdf = 0;

  for (const term of queryTerms) {
    const df = termDocFreqs.get(term) ?? 0;
    const weight = computeIdfWeight(df, totalDocs);
    totalWeight += weight;
    if (termMatchesDoc(term, doc)) {
      matchedCount++;
      matchedWeight += weight;
      if (weight > maxMatchedIdf) maxMatchedIdf = weight;
    }
  }

  return {
    coverage: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    uniformCoverage: matchedCount / queryTerms.length,
    matchedCount,
    maxMatchedIdf,
  };
}

/**
 * Deterministic exact-phrase and adjacent-bigram tie-breaker boost in [0, 0.08].
 * Rewards contiguous query phrases and verbatim code identifiers without inflating single-word noise.
 */
export function computePhraseProximityBoost(
  queryTerms: string[],
  docText: string,
  rawQuery?: string
): number {
  if (!docText || queryTerms.length === 0) return 0;

  const lowerDoc = docText.toLowerCase();
  let boost = 0;

  // 1. Verbatim compound code identifier match (e.g. tsconfig.tsbuildinfo, sqlite-vec, executeMemorySearch)
  if (rawQuery) {
    const codeIdents = rawQuery.match(COMPOUND_IDENT_RE) ?? [];
    for (const ident of codeIdents) {
      if (ident.length >= 5 && lowerDoc.includes(ident.toLowerCase())) {
        boost += 0.04;
        break;
      }
    }
  }

  // 2. Contiguous stemmed bigram matches (preserving term proximity order)
  if (queryTerms.length >= 2) {
    const docStems = (lowerDoc.match(/[\p{L}\p{N}]+/gu) ?? []).map(porterStem);
    const docBigrams = new Set<string>();
    for (let i = 0; i < docStems.length - 1; i++) {
      docBigrams.add(`${docStems[i]} ${docStems[i + 1]}`);
    }
    const queryStems = queryTerms.map(porterStem);
    let bigramHits = 0;
    const totalBigrams = queryStems.length - 1;
    for (let i = 0; i < totalBigrams; i++) {
      if (docBigrams.has(`${queryStems[i]} ${queryStems[i + 1]}`)) {
        bigramHits++;
      }
    }
    if (bigramHits > 0) {
      boost += 0.04 * (bigramHits / totalBigrams);
    }
  }

  return Math.min(0.08, boost);
}

export interface LexicalConfidenceContext {
  matchedCount?: number;
  maxMatchedIdf?: number;
  totalDocs?: number;
}

/**
 * Determines whether a lexical FTS5 hit passes confidence gating for default thresholded retrieval.
 * Uses IDF-weighted coverage + BM25 strength so rare technical terms clear default thresholds
 * cleanly while negative queries sharing only generic corpus words still abstain at 100%.
 */
export function isLexicalConfident(
  bm25Score: number,
  coverage: number,
  queryTermCount: number,
  threshold: number,
  context: LexicalConfidenceContext = {}
): boolean {
  if (threshold <= 0) return true;
  if (queryTermCount <= 1) {
    return coverage >= 1;
  }

  // Scale thresholds gently relative to the default 0.6 threshold when callers override it
  const ratio = Math.max(0.5, Math.min(1.5, threshold / 0.6));
  const highCovGate = Math.min(0.95, 0.45 * ratio);
  const midCovGate = Math.min(0.85, 0.28 * ratio);
  const rareCovGate = Math.min(0.75, 0.2 * ratio);

  // High IDF coverage passes even on tiny (1-3 row) corpora where Okapi BM25 IDF is near zero
  if (coverage >= highCovGate) return true;

  // Moderate IDF coverage with meaningful BM25 signal
  if (coverage >= midCovGate && bm25Score >= 0.28 * ratio) return true;

  // Rare discriminator rescue: strong BM25 + either >= 2 matched terms OR a genuinely rare corpus term
  const matchedCount = context.matchedCount ?? 0;
  const maxMatchedIdf = context.maxMatchedIdf ?? 0;
  const totalDocs = context.totalDocs ?? 0;
  const rareIdfFloor = totalDocs >= 10 ? Math.log(1 + totalDocs / 4) : 1.4;

  if (
    coverage >= rareCovGate &&
    bm25Score >= 0.45 * ratio &&
    (matchedCount >= 2 || maxMatchedIdf >= rareIdfFloor)
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Reciprocal Rank Fusion (RRF)
// ============================================================================

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

// ============================================================================
// Auto-Dream Zero-LLM Conflict-Guarded Lexical Deduplication (#150)
// ============================================================================

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
  'running',
  'prefer',
  'prefers',
  'preferred',
  'licensed',
  'license',
  'via',
  'per',
  'each',
  'every',
  'all',
]);

const NEGATION_PAIRS: [RegExp, RegExp][] = [
  [/\blikes?\b/i, /\bdislikes?\b/i],
  [/\bprefers?\b/i, /\bavoids?\b/i],
  [/\benabled?\b/i, /\bdisabled?\b/i],
  [/\ballows?\b/i, /\bforbids?\b/i],
  [/\btrue\b/i, /\bfalse\b/i],
  [/\bdark\b/i, /\blight\b/i],
  [/\bpublic\b/i, /\bprivate\b/i],
  [/\brequired\b/i, /\boptional\b/i],
  [/\blocal\b/i, /\bremote\b/i],
  [/\bsync(?:hronous)?\b/i, /\basync(?:hronous)?\b/i],
];

const NEGATION_MARKERS =
  /\b(not|never|no|don't|doesn't|isn't|aren't|won't|cannot|can't|dislikes?|forbids?|avoids?|disabled?)\b/i;

function normalizeForDedup(text: string): string {
  return text
    .replace(/\bcontinuous integration\b/gi, 'ci')
    .replace(/\bnode\.js\b/gi, 'nodejs')
    .replace(/\bnode\b/gi, 'nodejs')
    .replace(/\bjavascript\b/gi, 'js')
    .replace(/\btypescript\b/gi, 'ts')
    .replace(/\bpostgres(?:ql)?\b/gi, 'postgresql');
}

function extractNumbers(text: string): string[] {
  return [...new Set(text.match(/\d+(?:\.\d+)*/g) ?? [])].sort();
}

function extractUrlsAndPaths(text: string): string[] {
  const matches = text.match(/(?:https?|obsidian|vault):\/\/\S+|(?:~|\.\.?)\/[\w./-]+/gi) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[.,;:!?)]+$/, '').toLowerCase()))].sort();
}

function extractInternalProperNouns(text: string): string[] {
  // Capture capitalized words that are NOT at index 0 (e.g. Berlin, Lisbon, PostgreSQL, Apache, React, Vue)
  const matches = text.slice(1).match(/\b[A-Z][a-zA-Z0-9._-]{2,}\b/g) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

function tokenizeForDedup(normalizedText: string): Set<string> {
  const rawWords = normalizedText.match(/[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*/gu) ?? [];
  const stems = new Set<string>();
  for (const raw of rawWords) {
    for (const part of splitCodeIdentifier(raw)) {
      if (part.length <= 1 || DEDUP_STOPWORDS.has(part)) continue;
      stems.add(porterStem(part));
    }
  }
  return stems;
}

/**
 * Zero-LLM lexical near-duplicate detector with deterministic Porter stem normalization
 * and strict conflict guards (version numbers/ports, URLs/paths, opposing polarity/negation,
 * and differing proper entities).
 */
export function areLexicallyDuplicate(a: string, b: string, threshold: number = 0.6): boolean {
  const cleanA = a.trim();
  const cleanB = b.trim();
  if (!cleanA || !cleanB) return false;
  if (cleanA.toLowerCase() === cleanB.toLowerCase()) return true;

  // Guard 1: Differing numeric values / versions / ports (e.g. PostgreSQL 15 vs PostgreSQL 16, port 8080 vs 8443)
  const numsA = extractNumbers(cleanA);
  const numsB = extractNumbers(cleanB);
  if (numsA.length > 0 && numsB.length > 0 && numsA.join(',') !== numsB.join(',')) {
    return false;
  }

  // Guard 2: Distinct URLs / URIs / file paths
  const urlsA = extractUrlsAndPaths(cleanA);
  const urlsB = extractUrlsAndPaths(cleanB);
  if (urlsA.length > 0 && urlsB.length > 0 && urlsA.join(',') !== urlsB.join(',')) {
    return false;
  }

  // Guard 3: Polarity / negation contradiction (e.g. likes vs dislikes, dark vs light, enabled vs disabled)
  if (NEGATION_MARKERS.test(cleanA) !== NEGATION_MARKERS.test(cleanB)) {
    return false;
  }
  for (const [pos, neg] of NEGATION_PAIRS) {
    if ((pos.test(cleanA) && neg.test(cleanB)) || (neg.test(cleanA) && pos.test(cleanB))) {
      return false;
    }
  }

  // Guard 4: Conflicting proper entities (e.g. Berlin vs Lisbon, React vs Vue)
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

  const tokensA = tokenizeForDedup(normA);
  const tokensB = tokenizeForDedup(normB);

  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 && intersection / union >= threshold;
}
