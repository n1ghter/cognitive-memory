## Summary
<!-- Concise explanation of WHAT changed and WHY. Link the issue below. -->

Closes #

## Type of Change
- [ ] Feature (`feat`)
- [ ] Bug fix (`fix`)
- [ ] Architecture / Docs / ADR (`docs`)
- [ ] Harness / Evals / CI (`test`, `ci`, `chore`)
- [ ] Security hardening (`security`)

## Determinism & Architecture Check
- [ ] Follows [ADR 0002 (Deterministic-First Engineering)](docs/adr/0002-deterministic-first-engineering.md) — no unnecessary non-deterministic LLM dependency introduced; offline fallback tested if an optional LLM path exists.
- [ ] Preserves test isolation (`:memory:` local & global DBs), stdio purity (`console.error` only in `src/`), and loopback-first HTTP defaults.

## Verification
- [ ] `pnpm verify` passes locally (Biome + `tsc -b` + build + root tests & offline eval gate + UI build & tests).
- [ ] Added unit tests and/or regression cases in `evals/dataset.json` (if touching retrieval, dedup, or temporal logic).
- [ ] Updated `CHANGELOG.md` under `## [Unreleased]` (for notable user-facing changes) and docs/ADRs if behavior changed.
