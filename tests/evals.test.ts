import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkReportAgainstBaseline,
  formatComparisonTable,
  formatScorecard,
  loadBaseline,
  runEvals,
  useHashEmbedder,
  useOfflineEmbedder,
} from '../evals/harness.js';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';

const dataset = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '../evals/dataset.json'), 'utf8')
);
const baseline = loadBaseline(path.join(import.meta.dirname, '../evals/baseline.json'));

// Regression gates for deterministic offline eval runs backed by evals/baseline.json.
// Raise baseline floors whenever retrieval improves; never lower them silently (ADR 0004).
describe('Memory evals (Baseline Gate, Tracks A-D)', () => {
  afterEach(() => {
    DatabaseManager.close();
    EmbeddingCache.clear();
  });

  it('meets offline-bm25 baseline floors with zero Ollama and passes Track D round-trip invariants', async () => {
    useOfflineEmbedder();
    const report = await runEvals(dataset, { embedder: 'offline', k: 5, mode: 'hybrid' });
    console.log(formatScorecard(report));

    expect(report.roundTrip.errors).toEqual([]);
    expect(report.roundTrip.passRate).toBe(1);
    expect(checkReportAgainstBaseline(report, baseline, 'offline-bm25')).toEqual([]);
  });

  it('meets hash-vector and hash-hybrid baseline floors and keeps Hybrid RRF >= pure vector', async () => {
    useHashEmbedder();
    const vecReport = await runEvals(dataset, { embedder: 'hash', k: 5, mode: 'vector' });

    DatabaseManager.close();
    EmbeddingCache.clear();

    const hybridReport = await runEvals(dataset, { embedder: 'hash', k: 5, mode: 'hybrid' });
    console.log(formatComparisonTable([vecReport, hybridReport]));

    expect(checkReportAgainstBaseline(vecReport, baseline, 'hash-vector')).toEqual([]);
    expect(checkReportAgainstBaseline(hybridReport, baseline, 'hash-hybrid')).toEqual([]);
    expect(hybridReport.ranking.overall.recallAtK).toBeGreaterThanOrEqual(
      vecReport.ranking.overall.recallAtK
    );
    expect(hybridReport.roundTrip.passRate).toBe(1);
  });

  it('meets hash-hybrid-noise60 baseline floors under 60 unrelated distractor memories', async () => {
    useHashEmbedder();
    const noisyReport = await runEvals(dataset, {
      embedder: 'hash',
      k: 5,
      mode: 'hybrid',
      noiseCount: 60,
    });
    console.log(formatScorecard(noisyReport));

    expect(checkReportAgainstBaseline(noisyReport, baseline, 'hash-hybrid-noise60')).toEqual([]);
    expect(noisyReport.roundTrip.passRate).toBe(1);
  });

  it('detects metric regressions deterministically via checkReportAgainstBaseline', async () => {
    useOfflineEmbedder();
    const report = await runEvals(dataset, {
      embedder: 'offline',
      k: 5,
      mode: 'hybrid',
      includeRoundTrip: false,
    });
    const degraded = {
      ...report,
      thresholded: { ...report.thresholded, negativeAbstention: 0.75 },
      contradictions: { ...report.contradictions, staleLeakRate: 0.25 },
    };

    const violations = checkReportAgainstBaseline(degraded, baseline, 'offline-bm25');
    expect(violations.map((v) => v.metric)).toEqual(
      expect.arrayContaining(['negativeAbstention', 'contradictionsMaxStaleLeakRate'])
    );
  });
});
