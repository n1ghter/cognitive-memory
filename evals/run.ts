import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { SearchMode } from '../src/retrieval.js';

/**
 * Runs the memory evals against a throwaway database and prints a scorecard.
 *
 *   npx tsx evals/run.ts                                # real embeddings from local Ollama (hybrid)
 *   npx tsx evals/run.ts --embedder hash                # deterministic, no model needed
 *   npx tsx evals/run.ts --embedder none --mode bm25    # pure zero-Ollama SQLite FTS5 BM25
 *   npx tsx evals/run.ts --embedder hash --mode compare --noise 60
 *   npx tsx evals/run.ts --embedder hash --mode compare --check-baseline
 *   npx tsx evals/run.ts --k 3 --json report.json
 */
const { values } = parseArgs({
  options: {
    embedder: { type: 'string', default: 'ollama' },
    mode: { type: 'string', default: 'hybrid' },
    noise: { type: 'string', default: '0' },
    k: { type: 'string', default: '5' },
    dataset: { type: 'string', default: path.join(import.meta.dirname, 'dataset.json') },
    baseline: { type: 'string', default: path.join(import.meta.dirname, 'baseline.json') },
    'check-baseline': { type: 'boolean', default: false },
    json: { type: 'string' },
  },
});

if (values.embedder !== 'ollama' && values.embedder !== 'hash' && values.embedder !== 'none') {
  console.error(`Unknown --embedder "${values.embedder}". Use "ollama", "hash", or "none".`);
  process.exit(1);
}

if (
  values.mode !== 'hybrid' &&
  values.mode !== 'bm25' &&
  values.mode !== 'vector' &&
  values.mode !== 'compare'
) {
  console.error(`Unknown --mode "${values.mode}". Use "hybrid", "bm25", "vector", or "compare".`);
  process.exit(1);
}

// The DB path is read when src/db.ts loads, so it must be set before the harness is imported.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cognitive-memory-evals-'));
const dbFile = path.join(tmpDir, 'evals.sqlite');
process.env.MEMORY_DB_PATH = dbFile;
process.env.MEMORY_GLOBAL_DB_PATH = ':memory:';
if (values.embedder === 'none') {
  process.env.EMBEDDING_PROVIDER = 'none';
}

function resetEvalDbFiles(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const target = `${dbFile}${suffix}`;
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  }
}

const { DatabaseManager } = await import('../src/db.js');
const { EmbeddingCache } = await import('../src/cache.js');
const {
  checkReportAgainstBaseline,
  formatComparisonTable,
  formatScorecard,
  loadBaseline,
  resolveBaselineProfileKey,
  runEvals,
  useHashEmbedder,
  useOfflineEmbedder,
} = await import('./harness.js');

if (values.embedder === 'hash') useHashEmbedder();
if (values.embedder === 'none') useOfflineEmbedder();

// The search and cache layers log to stderr; keep the scorecard readable.
console.error = () => {};

try {
  const dataset = JSON.parse(fs.readFileSync(values.dataset, 'utf8'));
  const k = Number(values.k);
  const noiseCount = Number(values.noise);
  const reports = [];

  if (values.mode === 'compare') {
    const modes: SearchMode[] = ['bm25', 'vector', 'hybrid'];
    for (const mode of modes) {
      DatabaseManager.close();
      EmbeddingCache.clear();
      resetEvalDbFiles();
      const report = await runEvals(dataset, {
        embedder: values.embedder,
        k,
        mode,
        noiseCount,
      });
      reports.push(report);
      console.log(formatScorecard(report));
      console.log('');
    }
    console.log(formatComparisonTable(reports));
    if (values.json) fs.writeFileSync(values.json, `${JSON.stringify(reports, null, 2)}\n`);
  } else {
    const report = await runEvals(dataset, {
      embedder: values.embedder,
      k,
      mode: values.mode as SearchMode,
      noiseCount,
    });
    reports.push(report);
    console.log(formatScorecard(report));
    if (values.json) fs.writeFileSync(values.json, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (values['check-baseline']) {
    const baseline = loadBaseline(values.baseline);
    const allViolations = [];
    for (const report of reports) {
      const profileKey = resolveBaselineProfileKey(report.embedder, report.mode, report.noiseCount);
      if (!profileKey) continue;
      allViolations.push(...checkReportAgainstBaseline(report, baseline, profileKey));
    }

    if (allViolations.length > 0) {
      console.log('\n❌ Baseline regression check FAILED:');
      for (const v of allViolations) {
        const cmp = v.direction === 'min' ? '<' : '>';
        console.log(
          `  [${v.profile}] ${v.metric}: ${(v.actual * 100).toFixed(2)}% ${cmp} baseline ${(v.expected * 100).toFixed(2)}%`
        );
      }
      process.exitCode = 1;
    } else {
      console.log(`\n✅ Baseline regression check PASSED (${path.basename(values.baseline)}).`);
    }
  }
} catch (error) {
  console.log(`Eval run failed: ${(error as Error).message}`);
  if (values.embedder === 'ollama') {
    console.log(
      'Is Ollama running? Or use --embedder hash or --embedder none --mode bm25 for offline runs.'
    );
  }
  process.exitCode = 1;
} finally {
  DatabaseManager.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
