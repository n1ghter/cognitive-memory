# ADR 0002: Deterministic-First Engineering Principle

- **Status:** Accepted
- **Date:** 2026-11-25
- **Related:** [AGENTS.md](../../AGENTS.md), [ADR 0004](0004-continuous-harness-and-eval-driven-development.md)

## Context

AI-assisted systems frequently over-rely on probabilistic LLM calls or ad-hoc human discipline for tasks that have exact, repeatable rules: indexing, deduplication safety, threshold evaluation, formatting, release validation, and repository hygiene. Non-determinism compounds across sessions, causes flaky tests, hides regressions, and wastes tokens.

## Decision

**Everything that can realistically and meaningfully be made deterministic MUST be deterministic.**

Non-deterministic LLM calls are reserved strictly for optional, additive semantic synthesis where deterministic logic genuinely cannot suffice — and must always be paired with:

1. A deterministic fallback path that works offline with zero external services.
2. Deterministic safety guards (e.g., numeric/version conflict guards, schema validation via Zod, bounded recursion depth).
3. Deterministic verification tests and offline eval gates.

### Concrete Application Across Subsystems

| Subsystem                        | Deterministic Mechanism                                                                          | Optional Non-Deterministic Layer        |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Retrieval**                    | SQLite `FTS5` BM25 + RRF rank fusion + deterministic `hash` embedder for CI                      | Local Ollama / pluggable dense embedder |
| **Storage & Sync**               | Exact SHA-256 / content dedup, YAML frontmatter parsing, lossless `memory_reindex`               | None                                    |
| **Temporal Truth**               | Explicit `valid_from` / `valid_until` / `superseded_by` columns & `supersedes` edge              | None                                    |
| **Consolidation ("Auto Dream")** | Exponential decay + lexical Jaccard similarity + version/polarity/entity conflict guards         | Optional Ollama LLM summary merge       |
| **Verification & Release**       | `pnpm verify`, Biome CI, `tsc -b`, offline `evals`, tag-vs-`package.json` parity check           | Live Ollama `pnpm eval` scorecard       |
| **GitHub Governance**            | Declarative `.github/labels.json`, path-based PR auto-labeler, YAML Issue Forms, branch rulesets | Human/agent PR design review            |

## Consequences

- **Positive:** Reproducible builds, zero-flakiness CI, predictable offline behavior for every contributor, and drastically lower token/latency overhead.
- **Discipline Required:** Before introducing any LLM call, heuristic prompt rule, or manual checklist step, contributors and agents must first ask: _"Can this be enforced deterministically in code, SQL, schema, or CI?"_

## Verification

- All tests in `pnpm verify` run with zero network calls and zero LLM dependencies.
- Every bug fix or governance rule prefers executable checks over prose reminders.
