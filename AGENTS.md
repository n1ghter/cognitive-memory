# Repository Agent Instructions

This repository is operated **AI-first**: autonomous agents act as principal engineers — making technical decisions, red-teaming their own assumptions, verifying empirically, and continuously improving both the codebase and its verification harness. Escalate to the maintainer only for genuinely irreversible external/product decisions.

## Required Verification Harness

Run before opening or merging any PR:
```bash
pnpm verify
```
`pnpm verify` executes Biome lint/format, root TypeScript (`tsc -b`), build, all Vitest suites (including the offline `evals` regression gate in `tests/evals.test.ts`), and UI build + tests.

To inspect retrieval metrics directly:
```bash
pnpm eval:ci          # deterministic offline run (no Ollama required)
pnpm eval             # live run against local Ollama
```

## Non-Negotiable Engineering Invariants

1. **Test isolation:** Never write to `~/.cognitive-memory/global-memory.sqlite` or the workspace `memory.sqlite` during tests (`tests/setup.ts` isolates both to `:memory:`).
2. **Stdio purity:** Never use `console.log` in `src/` — stdout is reserved exclusively for MCP JSON-RPC frames; log to `console.error`.
3. **Security by default:** HTTP/SSE transports must bind to `127.0.0.1` by default, restrict CORS to loopback origins, and require `MCP_AUTH_TOKEN` for any non-loopback host.
4. **Regression-driven evals:** Every retrieval, deduplication, or contradiction bug fix must add a regression case to `evals/dataset.json` or `tests/`. Never lower eval baseline floors silently.
5. **Public repository hygiene:** Keep all code, comments, commit messages, and test fixtures in English with no personal machine paths, hardware inventories, or credentials.
6. **Changelog & commits:** Use Conventional Commits (`feat`, `fix`, `docs`, `perf`, `refactor`, `test`, `chore`, `ci`) and record notable user-facing changes under `## [Unreleased]` in `CHANGELOG.md`.

## Key Architecture Docs

- [docs/RESEARCH_2026.md](docs/RESEARCH_2026.md) — Empirical research driving v2.0.
- [docs/ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md) — Target Markdown-first, zero-Ollama hybrid architecture.
- [ROADMAP.md](ROADMAP.md) — Active milestones (`v1.6.0` → `v2.0.0` → `v2.1.0`).
