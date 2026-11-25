# Cognitive Memory Evaluation Harness (`evals/`)

Grounded in [ADR 0002 (Deterministic-First Engineering)](../docs/adr/0002-deterministic-first-engineering.md) and [ADR 0004 (Continuous Harness Engineering)](../docs/adr/0004-continuous-harness-and-eval-driven-development.md), every retrieval, deduplication, temporal, and storage invariant is measured quantitatively and guarded by committed offline baseline floors in [`evals/baseline.json`](./baseline.json).

## Evaluation Tracks

| Track | Scope | Deterministic Offline Gate |
| --- | --- | --- |
| **Track A — Retrieval Matrix** | Benchmarks `bm25` (zero-Ollama FTS5), `vector`, and `hybrid` (RRF) on `Recall@K`, `Hit@1`, `MRR`, `nDCG@K`, `Default-Threshold Recall`, and `Negative Abstention` | Enforced in `pnpm verify` & `pnpm eval:check` |
| **Track B — Contradiction & Temporal Supersession** | Verifies updated facts (`supersedes`) rank `#1` (`100% resolved@1`) with `0%` stale leaks | Enforced in `pnpm verify` & `pnpm eval:check` |
| **Track C — Distractor Noise Stress** | Injects 60 unrelated distractor memories (`--noise 60`, modeled after `arXiv:2605.15184`) to verify precision resilience | Enforced in `pnpm verify` (`hash-hybrid-noise60`) |
| **Track D — Round-Trip & Grounding Invariants** | Verifies lossless Markdown ↔ SQLite `memory_export` → `memory_reindex` fidelity across profiles, zero-copy `metadata.ref` pointers, internal/external edges, temporal metadata, and `is_active = 0` placeholders | Enforced in `pnpm verify` (`roundTripPassRate: 1.0`) |
| **Track E — Real Dogfooding Regressions** | Continuous regression ingestion from daily cross-tool usage (Claude Code, Cursor, Antigravity) | Permanent cases appended to `evals/dataset.json` |

## Commands

```bash
# Full deterministic CI baseline check (zero Ollama required)
pnpm eval:check

# Compare bm25 vs vector vs hybrid under 60-distractor noise
npx tsx evals/run.ts --embedder hash --mode compare --noise 60 --check-baseline

# Pure zero-Ollama SQLite FTS5 BM25 scorecard
npx tsx evals/run.ts --embedder none --mode bm25 --check-baseline

# Live scorecard against local Ollama embeddings
pnpm eval
```

## Track E: Real Dogfooding Regression Workflow

Whenever a real session uncovers a retrieval miss, false positive on an unrelated query, false dedup merge, or stale contradiction leak:

1. **Sanitize the example:** Rewrite the memory text and query in English with zero personal paths, credentials, or private data (see `AGENTS.md` Invariant #5).
2. **Add a permanent regression case** to [`evals/dataset.json`](./dataset.json) under `memories`/`queries` (with appropriate category: `lexical`, `paraphrase`, `cross-lingual`, or `negative`), `dedupPairs`, `contradictions`, or `roundTrip`.
3. **Reproduce failure offline** via `pnpm eval:check` or `pnpm test tests/evals.test.ts`.
4. **Fix the engine deterministically** and verify all tracks pass.
5. **Ratchet `evals/baseline.json` upward** when quality improves. Never silently lower baseline floors without explicit justification in a PR and ADR.
