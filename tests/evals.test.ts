import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  formatComparisonTable,
  formatScorecard,
  runEvals,
  useHashEmbedder,
  useOfflineEmbedder,
} from '../evals/harness.js';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';

const dataset = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '../evals/dataset.json'), 'utf8')
);

// Regression gates for deterministic offline eval runs.
// Raise floors whenever retrieval improves; never lower them silently.
describe('Memory evals (BM25 zero-Ollama, Vector baseline, Hybrid RRF, Noise stress)', () => {
  afterEach(() => {
    DatabaseManager.close();
    EmbeddingCache.clear();
  });

  it('works cleanly with zero Ollama (pure FTS5 BM25 fallback) and preserves negative abstention', async () => {
    useOfflineEmbedder();
    const report = await runEvals(dataset, { embedder: 'offline', k: 5, mode: 'hybrid' });
    console.log(formatScorecard(report));

    expect(report.ranking.byCategory.lexical.recallAtK).toBeGreaterThanOrEqual(0.95);
    expect(report.ranking.byCategory.lexical.hitAt1).toBe(1);
    expect(report.thresholded.recallAtK).toBeGreaterThanOrEqual(0.5);
    expect(report.thresholded.negativeAbstention).toBe(1);
    expect(report.lexicalDedup.accuracy).toBeGreaterThanOrEqual(0.875);
    expect(report.contradictions.resolvedRate).toBe(1);
    expect(report.contradictions.staleLeakRate).toBe(0);
  });

  it('keeps Hybrid RRF >= pure vector baseline and fixes the default-threshold recall cliff', async () => {
    useHashEmbedder();
    const vecReport = await runEvals(dataset, { embedder: 'hash', k: 5, mode: 'vector' });

    DatabaseManager.close();
    EmbeddingCache.clear();

    const hybridReport = await runEvals(dataset, { embedder: 'hash', k: 5, mode: 'hybrid' });
    console.log(formatComparisonTable([vecReport, hybridReport]));

    // Pure vector baseline floors (preserved)
    expect(vecReport.ranking.overall.recallAtK).toBeGreaterThanOrEqual(0.81);
    expect(vecReport.ranking.overall.mrr).toBeGreaterThanOrEqual(0.74);

    // Hybrid RRF floors (strictly stronger overall & default-threshold recall!)
    expect(hybridReport.ranking.overall.recallAtK).toBeGreaterThanOrEqual(
      vecReport.ranking.overall.recallAtK
    );
    expect(hybridReport.ranking.byCategory.lexical.recallAtK).toBeGreaterThanOrEqual(0.95);
    expect(hybridReport.ranking.byCategory.lexical.hitAt1).toBe(1);
    expect(hybridReport.thresholded.recallAtK).toBeGreaterThanOrEqual(0.5);
    expect(hybridReport.thresholded.negativeAbstention).toBe(1);
  });

  it('stays resilient under 60 unrelated distractor memories (arXiv:2605.15184 noise test)', async () => {
    useHashEmbedder();
    const noisyReport = await runEvals(dataset, {
      embedder: 'hash',
      k: 5,
      mode: 'hybrid',
      noiseCount: 60,
    });
    console.log(formatScorecard(noisyReport));

    expect(noisyReport.ranking.overall.recallAtK).toBeGreaterThanOrEqual(0.8);
    expect(noisyReport.ranking.byCategory.lexical.hitAt1).toBe(1);
    expect(noisyReport.thresholded.negativeAbstention).toBe(1);
  });
});
