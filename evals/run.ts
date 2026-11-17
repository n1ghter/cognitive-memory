import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

/**
 * Runs the memory evals against a throwaway database and prints a scorecard.
 *
 *   npx tsx evals/run.ts                    # real embeddings from local Ollama
 *   npx tsx evals/run.ts --embedder hash    # deterministic, no model needed
 *   npx tsx evals/run.ts --k 3 --json report.json
 */
const { values } = parseArgs({
  options: {
    embedder: { type: 'string', default: 'ollama' },
    k: { type: 'string', default: '5' },
    dataset: { type: 'string', default: path.join(import.meta.dirname, 'dataset.json') },
    json: { type: 'string' },
  },
});

if (values.embedder !== 'ollama' && values.embedder !== 'hash') {
  console.error(`Unknown --embedder "${values.embedder}". Use "ollama" or "hash".`);
  process.exit(1);
}

// The DB path is read when src/db.ts loads, so it must be set before the harness is imported.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cognitive-memory-evals-'));
process.env.MEMORY_DB_PATH = path.join(tmpDir, 'evals.sqlite');

const { DatabaseManager } = await import('../src/db.js');
const { formatScorecard, runEvals, useHashEmbedder } = await import('./harness.js');

if (values.embedder === 'hash') useHashEmbedder();

// The search and cache layers log to stderr; keep the scorecard readable.
console.error = () => {};

try {
  const dataset = JSON.parse(fs.readFileSync(values.dataset, 'utf8'));
  const report = await runEvals(dataset, { embedder: values.embedder, k: Number(values.k) });
  console.log(formatScorecard(report));
  if (values.json) fs.writeFileSync(values.json, `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  console.log(`Eval run failed: ${(error as Error).message}`);
  if (values.embedder === 'ollama') {
    console.log('Is Ollama running? Or use --embedder hash for the offline deterministic run.');
  }
  process.exitCode = 1;
} finally {
  DatabaseManager.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
