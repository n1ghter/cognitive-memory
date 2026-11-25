# Contributing to Cognitive Memory

Thank you for helping build a **vendor-neutral, Markdown-first, zero-Ollama MCP memory engine** shared across AI coding tools!

Whether you are a human contributor or an AI coding agent working on a PR, this guide defines the exact workflow and engineering bar for the repository.

---

## Quick Links & Where to Start

- **Engineering Board (GitHub Project):** [Cognitive Memory — Engineering Roadmap](https://github.com/users/n1ghter/projects/1) (public board with `Status`, `Priority`, `Area`, and `Determinism` fields).
- **Milestones:** [All Milestones](https://github.com/n1ghter/cognitive-memory/milestones) (`v2.0.0` shipped, `v2.1.0` active, `v2.2.0` next).
- **Curated Issue Views:**
  - [Active `v2.1.0` Milestone](https://github.com/n1ghter/cognitive-memory/issues?q=is%3Aopen+is%3Aissue+milestone%3A%22v2.1.0+%E2%80%94+Cross-Tool+Portability+%26+Hooks%22)
  - [Good First Issues](https://github.com/n1ghter/cognitive-memory/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)
  - [Help Wanted (Collaborator Queue)](https://github.com/n1ghter/cognitive-memory/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22)
  - [Determinism & Evals](https://github.com/n1ghter/cognitive-memory/issues?q=is%3Aopen+is%3Aissue+label%3Adeterminism)
  - [Security & Dependencies](https://github.com/n1ghter/cognitive-memory/issues?q=is%3Aopen+is%3Aissue+label%3Asecurity)
- **Architecture Decisions (ADRs):** [docs/adr/README.md](docs/adr/README.md) — read before proposing structural changes.
- **Design RFCs & Q&A:** [GitHub Discussions](https://github.com/n1ghter/cognitive-memory/discussions).

---

## Local Development Setup

### Prerequisites
- **Node.js `24+`**
- **`pnpm` `9+`**
- **Ollama is optional:** The entire test suite, build, and offline eval harness run **100% deterministically offline** with zero external daemons.

### Setup Steps

```bash
git clone https://github.com/n1ghter/cognitive-memory.git
cd cognitive-memory
pnpm install
pnpm rebuild better-sqlite3 sqlite-vec
pnpm verify
```

### Verification Harness Commands

| Command | What It Checks |
| --- | --- |
| `pnpm verify` | **Required before every PR:** Biome lint/format, `tsc -b`, `dist/` build, all 116+ Vitest suites (including offline eval gates), and `ui/` build + tests. |
| `pnpm eval:ci` | Deterministic offline retrieval scorecard (no Ollama required). |
| `pnpm eval` | Live Hybrid RRF benchmark against local Ollama. |
| `pnpm check:fix` | Auto-format and auto-fix Biome lint issues. |
| `pnpm dashboard` | Launch optional read-only 3D Graph Explorer at `http://localhost:3000`. |

---

## Engineering Principles & Invariants

Before opening a PR, review [AGENTS.md](AGENTS.md) and [ADR 0002 (Deterministic-First Engineering)](docs/adr/0002-deterministic-first-engineering.md):

1. **Deterministic-First:** Everything that can realistically be made deterministic (indexing, parsing, schema validation, conflict guards, CI gates, offline evals) **must** be deterministic. Non-deterministic LLM calls are strictly optional additive layers with tested offline fallbacks.
2. **Test Isolation:** Never write to `~/.cognitive-memory/global-memory.sqlite` or the workspace `memory.sqlite` during tests (`tests/setup.ts` isolates both to `:memory:`).
3. **Stdio Purity:** Never call `console.log` inside `src/` — stdout is reserved exclusively for MCP JSON-RPC frames. Log diagnostics via `console.error`.
4. **Security by Default:** Any HTTP/SSE transport must bind to `127.0.0.1` by default, restrict CORS to loopback origins, and require `MCP_AUTH_TOKEN` for non-loopback hosts.
5. **Regression-Driven Evals:** Every retrieval, deduplication, or temporal contradiction bug fix must include a regression case in `evals/dataset.json` or `tests/`. Never lower eval baseline floors silently.
6. **Public Repository Hygiene:** Keep all code, comments, commit messages, docs, and test fixtures in English, free of personal machine paths, hardware inventories, or credentials.
7. **Frozen 3D UI (`ui/`):** See [ADR 0005](docs/adr/0005-frozen-3d-ui-and-cross-tool-focus.md) — `ui/` is maintenance-only (security/build/test fixes only; new feature effort targets core retrieval, storage, and cross-tool portability).

---

## Pull Request Workflow

1. Comment on an existing Issue (or open one using our structured YAML forms) so effort isn't duplicated.
2. Branch off `main` using a descriptive name (`feat/...`, `fix/...`, `docs/...`, `chore/...`).
3. Keep PRs focused on a single concern and commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat(engine): ...`, `fix(storage): ...`, `docs(adr): ...`).
4. Run `pnpm verify` locally and ensure zero errors or warnings.
5. Record notable user-facing changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
6. Fill out the Pull Request template completely and link the resolved issue (`Closes #...`).

All PRs are squash-merged into `main` once the required `test` CI check passes.
