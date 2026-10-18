import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { formatScorecard, runEvals, useHashEmbedder } from '../evals/harness.js';
import { DatabaseManager } from '../src/db.js';

const dataset = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '../evals/dataset.json'), 'utf8')
);

// Regression gate for the deterministic eval run. The floors are the scores the hash embedder
// reached when the suite was added; raise them when retrieval improves, never lower them silently.
describe('Memory evals (deterministic hash embedder)', () => {
  afterAll(() => DatabaseManager.close());

  it('keeps retrieval quality at or above the recorded baseline', async () => {
    useHashEmbedder();
    const report = await runEvals(dataset, { embedder: 'hash', k: 5 });
    console.log(formatScorecard(report));

    expect(report.ranking.overall.recallAtK).toBeGreaterThanOrEqual(0.81);
    expect(report.ranking.overall.mrr).toBeGreaterThanOrEqual(0.74);
    expect(report.ranking.byCategory.lexical.recallAtK).toBeGreaterThanOrEqual(0.95);
    expect(report.ranking.byCategory.lexical.hitAt1).toBe(1);
    expect(report.thresholded.precision).toBe(1);
    expect(report.thresholded.negativeAbstention).toBe(1);
  });
});
