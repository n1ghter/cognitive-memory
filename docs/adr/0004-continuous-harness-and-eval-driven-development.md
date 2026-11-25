# ADR 0004: Continuous Harness Engineering & Regression-Driven Evals

- **Status:** Accepted
- **Date:** 2026-11-25
- **Related:** [docs/RESEARCH_2026.md](../RESEARCH_2026.md), [AGENTS.md](../../AGENTS.md), PR `#122`, `#137`, `#138`

## Context

Empirical agent research (`arXiv:2605.15184`, `arXiv:2602.11988`, `arXiv:2606.15828`, `arXiv:2611.04367`) established two core lessons:

1. **$\text{Agent} = \text{Model} + \text{Harness}$:** Retrieval and engineering quality depend primarily on deterministic feedback loops and objective benchmarks rather than intuitive tuning.
2. **Instruction bloat harms performance:** Long, auto-generated `AGENTS.md` checklists lower task success (~`-3%`) and add `>20%` token overhead.

## Decision

Operate `cognitive-memory` around a **4-layer Continuous Harness Engineering Loop** governed by a strict **anti-bloat rule** (every new check or eval case must map to a real failure mode, benchmark hypothesis, or user regression):

1. **Feedforward Layer (Minimal, High-Signal Context):**
   - Keep `AGENTS.md` ultra-concise (non-negotiable invariants + verification commands + doc pointers).
   - Store deep rationale in versioned `docs/` and `docs/adr/`, never as repetitive prompt checklists.
2. **Deterministic Fast Sensors (Local + CI):**
   - Single entry point `pnpm verify` executing Biome lint/format, root `tsc -b`, build, all Vitest suites (including offline eval gates), and UI build + tests.
   - Structural guards: `:memory:` DB isolation in tests, stdio stdout purity (`console.error` only in `src/`), loopback-default HTTP binding, English-only public fixtures.
3. **Quantitative Memory Evals (`evals/` — Regression-Driven Tracks):**
   - **Track A (Retrieval Matrix):** Compare `bm25` vs. `vector` vs. `hybrid` (RRF) on identical datasets, offline and live.
   - **Track B (Contradiction & Temporal Supersession):** Ensure updated facts rank `#1` with `0%` stale leaks.
   - **Track C (Noise & Distractor Stress):** Measure precision resilience under injected unrelated distractor memories (`--noise 60`).
   - **Track D (Round-Trip & Grounding Invariants):** Verify lossless Markdown ↔ SQLite `reindex` and valid zero-copy `ref` pointers.
   - **Track E (Real Dogfooding Regressions):** Every real retrieval miss or false positive encountered in daily use becomes a permanent test case in `evals/dataset.json`.
   - **No silent floor drops:** CI regression baselines may only move upward unless justified explicitly in a PR and ADR.
4. **Entropy Management (Anti-Slop):**
   - Single lockfile (`pnpm-lock.yaml`), LF line endings (`.gitattributes`), automatic branch pruning, monthly grouped Dependabot PRs, and strict isolation of frozen `ui/` from core `src/`.

## Consequences

- **Positive:** Any contributor or autonomous AI agent receives identical, deterministic pass/fail signals in seconds before merging.
- **Trade-off:** Features take marginally more upfront effort to add eval cases, preventing silent quality decay over time.

## Verification

- `pnpm verify` and `pnpm eval:ci` run on every PR in `.github/workflows/ci.yml` and before every release in `.github/workflows/release.yml`.
