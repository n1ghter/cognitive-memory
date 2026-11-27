# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **MCP Streamable HTTP Shared Local Daemon (`#135`):** Added `StreamableHTTPServerTransport` (`/mcp` POST/GET/DELETE with per-session `McpServer` lifecycle & `mcp-session-id` header tracking) in `src/server/http.ts` alongside backwards-compatible legacy SSE (`/sse`, `/message`), added `/health` operational endpoint, graceful `SIGINT`/`SIGTERM` session & SQLite shutdown, loopback-default (`127.0.0.1`) + localhost-CORS (`403` on external origins) + mandatory timing-safe Bearer auth on non-loopback hosts, `--http` / `pnpm start:http` CLI support, and updated `Dockerfile` + `docker-compose.yml` with `HEALTHCHECK`.
- **Obsidian Vault Zero-Copy `ref` Drift Bridge (`#141`):** Added deterministic SHA-256 `source_hash` drift detection (`memory_check_refs` MCP tool, `cognitive-memory check-refs` CLI, and optional `checkRefs` on `memory_sync`) for full-file and Markdown `## section` pointers with path-traversal protection, frontmatter `ref_*` property export, optional `--update-hashes` refresh, and verified preservation of `is_active = 0` external URI placeholders across `export`/`sync`/`reindex`.
- **Cross-Tool Deterministic Importers (`#142`):** Added `cognitive-memory import-tool --source claude-code|cursor [--path ...] [--dry-run] [--scope ...] [--profile ...]` parsing Claude Code `MEMORY.md` (+ linked local topic files) and Cursor `.cursor/rules/*.mdc` / `.cursorrules` with zero-copy `metadata.ref` pointers and strict idempotency (0 duplicates on re-run).
- **Multi-IDE `setup` Expansion (`#134`):** Added Cline (`cline_mcp_settings.json` / `~/.cline/mcp_settings.json`) alongside Codex (`~/.codex/config.toml`) and existing IDEs, switched config patching to atomic temp-file-then-rename writes, and added `--dry-run` preview mode.
- **Sync Deletion Ledger ID Normalization (`src/tools/import.ts`):** Fixed bare-UUID vs. `memory:`-prefixed ID matching in `.sync_state.json` deletion tracking so `memory_export` followed by `memory_sync` no longer falsely soft-deletes unmodified active memories.
- **Anti-Smell `cognitive-memory init` & Deterministic Lifecycle Hooks (`#133`):** Replaced verbose `AGENTS.md` checklists with a concise, idempotently managed block (`<!-- cognitive-memory:start/end -->`), refreshed `.agents/skills/memory-auto-capture/SKILL.md` to lean v2.1 single-line YAML frontmatter, added deterministic lifecycle hook scaffolds (`.agents/hooks.json` for Antigravity 2.0 with strict `stdout` JSON contract `{}` / `{"decision":"allow"}` and direct non-`npx` execution, `.claude/settings.json` non-destructive merge, and `.cursor/rules/cognitive-memory.mdc` with `alwaysApply: false`), and wired `cognitive-memory hook <SessionStart|PreCompact|Stop|AutoDream> [--client antigravity] [--stdout-json]` CLI execution.
- **Deterministic Eval Baseline Gate & Track D/E Harness (`evals/baseline.json`):** Committed canonical offline retrieval/dedup/temporal/round-trip floor metrics (`evals/baseline.json`), wired `tests/evals.test.ts` and `evals/run.ts --check-baseline` (`pnpm eval:check`) to fail deterministically on any regression, added **Track D (Round-Trip & Grounding Invariants)** verifying lossless Markdown ↔ SQLite `reindex` with zero-copy `ref` pointers and inactive external placeholders, and documented the **Track E (Dogfooding Regressions)** workflow in `evals/README.md`. (#140)
- **Architecture Decision Records (`docs/adr/`):** Codified key architectural decisions (`0001`–`0005`), including **ADR 0002 (Deterministic-First Engineering)**, **ADR 0004 (Continuous Harness Engineering)**, and **ADR 0005 (Frozen 3D UI & Cross-Tool Focus)**.
- **Open-Source Governance & Deterministic GitHub Automation:** Added structured YAML Issue Forms (`bug_report.yml`, `feature_request.yml`, `eval_regression.yml`, `config.yml`), Pull Request template, `CODEOWNERS`, `CODE_OF_CONDUCT.md`, declarative Labels-as-Code (`.github/labels.json` + `scripts/sync-labels.ts`), and deterministic path-based PR auto-labeling (`.github/labeler.yml` + `.github/workflows/labeler.yml`).

### Changed

- **FTS5 Porter Stemming, Code-Aware Tokenization & Weighted Metadata (`#149`):** Upgraded `fts_memory` across `main` and `global` schemas to `porter unicode61 remove_diacritics 2` with automatic v2.0 → v2.1 migration/backfill, added `code_tokens` (`camelCase`/`PascalCase`/`snake_case`/`kebab-case`/dotted identifier splitting) and weighted `metadata_text` (`bm25(fts_memory, 1.0, 0.8, 0.5)`) columns, plus a deterministic exact-phrase/proximity tie-breaker boost (`Recall@5` `85.4% → 87.5%`, `Hit@1` `70.8% → 79.2%`, `MRR` `76.2% → 81.0%` offline hybrid; `Lexical Recall@5` `95.8% → 100.0%`).
- **IDF-Weighted Coverage & Default-Threshold Calibration (`#148`):** Replaced uniform term-coverage gating with exact SQLite FTS5 corpus IDF-weighted term coverage (`computeIdfWeightedCoverage`), raising offline Default-Threshold Recall from `60.4%` to `75.0%` in both zero-Ollama `bm25` and `hybrid` (clean & `--noise 60`) while holding `100.0%` Negative Abstention even against adversarial lexical-overlap negative queries.
- **Auto-Dream Zero-LLM Dedup Stem Normalization (`#150`):** Replaced naive suffix regex with deterministic Porter (1980) stemming and expanded conflict guards (ports, URLs/paths, theme/polarity pairs, proper entities), lifting zero-LLM dedup recall from `75.0%` to `100.0%` at `100.0%` precision across expanded `evals/dataset.json` pairs, and ratcheted `evals/baseline.json` floors upward.
- **Dependency Hygiene & Security:** Updated root (`better-sqlite3 13.2.0`, `@biomejs/biome 2.6.8`, `vitest 5.1.1`, `supertest 7.3.2`, `lint-staged 17.6.1`) and `ui/` dependencies (`three 0.187.0`, `jsdom 31.0.1`, `@testing-library/jest-dom 8.0.0`, `@types/node 26.6.6`), pruned stale root `pnpm-lock.yaml` entries resolving the last moderate `minimatch` alert (#144), and removed obsolete GitNexus skills/config leftovers.
- **Contributor & Security Docs:** Updated `CONTRIBUTING.md`, `SECURITY.md` (`2.0.x`), `AGENTS.md` (added Invariant #7 Deterministic-First Engineering), `ROADMAP.md`, and `README.md` to align with `v2.0.0`, Milestones `v2.1.0`/`v2.2.0`, GitHub Discussions, and curated Issue Views.

## [2.0.0] - 2026-11-25

### Added

- **Zero-Ollama SQLite FTS5 (BM25) & Hybrid RRF Retrieval**: Always-on `fts_memory` (`unicode61`) tables + sync triggers across `main` and `global` schemas with automatic backfill for existing DBs. `memory_store` and `memory_search` now work seamlessly offline (`EMBEDDING_PROVIDER=none` or automatic fallback when Ollama is unreachable) and fuse BM25 + optional dense vectors via Reciprocal Rank Fusion (`mode: hybrid | bm25 | vector`). (#129, #130, #137)
- **Markdown-First Canonical Storage & `reindex`**: Added `memory_reindex` MCP tool and `cognitive-memory reindex [vaultPath]` CLI to wipe and rebuild the SQLite FTS5 + optional vector index losslessly from Markdown notes (works completely offline). (#131, #138)
- **Temporal Supersession**: Added `valid_from`, `valid_until`, and `superseded_by` columns, `supersedes` parameter on `memory_store` (creating a `supersedes` edge), and `includeSuperseded` flag on `memory_search` / `memory_export`. Resolves 100% of temporal contradiction evals with 0% stale leak. (#132, #138)
- **Bounded 1–2 Hop CTE Subgraph Retrieval**: Added optional `includeGraph` and `graphDepth` (`1 | 2`) to `memory_search` to return directly connected memories and external `grounded_in` pointers in a single call. (#136, #138)
- **Zero-LLM "Auto Dream" Consolidation**: `memory_consolidate` now works without Ollama using conflict-guarded lexical deduplication (version numbers, opposing polarity, and entity guards) + deterministic merge fallback, while optionally upgrading synthesis via Ollama LLM when online. (#136, #138)
- **Engine Hardening, Profiles & Zero-Copy Grounding**: Added Ollama `AbortSignal` timeouts, O(1) bounded LRU L1 cache (`MAX_CACHE_SIZE = 1000`), single-pass CTE cosine search, schema+profile-scoped exact deduplication, 3-tier memory profiles (`user`, `working`, `agent_core`), Zod-validated zero-copy `ref` pointers, external URI relations (`obsidian://`, `vault://`), Node 24 Dockerfile, and hardened loopback-default SSE transport with timing-safe Bearer auth for remote bind. (#120, #121, co-authored with `@include9it`)
- **Federated Memory**: `memory_search` accepts a `scope` of `local` (default), `global`, or `all`, merging local and global results; `memory_store` accepts `scope` `local` (default) or `global`. Each result and stored record reports its `scope`. (#99, #119)
- **Configuration**: `MEMORY_GLOBAL_DB_PATH` overrides the global DB location (tests isolate both local and global DBs to `:memory:`). (#99, #119)
- **Any Embedding Model**: The vector table is dynamically sized from the configured `EMBEDDING_MODEL`'s output instead of being hardcoded to 4096 dimensions. (#101, #119)
- **Continuous Harness Engineering & Evals**: Added unified `pnpm verify` command and expanded `evals/` with `--mode compare`, `--noise` distractor stress tests, temporal contradiction evals, and zero-LLM Auto-Dream dedup evals. (#103, #122, #137, #138)
- **2026 Research & Architecture Docs**: Published `docs/RESEARCH_2026.md`, `docs/ARCHITECTURE_V2.md`, rewritten `ROADMAP.md` & `README.md`, lean AI-first `AGENTS.md`, and GitHub Wiki. (#128)

### Changed

- **CI/CD & Security Hygiene**: Overhauled `ci.yml` (pnpm cache, `--frozen-lockfile`, Biome, root `tsc`, coverage, eval gate, UI build + tests) and `release.yml` (tag/version parity check + full verification before publish), hardened `auto-create-pr.yml` to draft-only without blind auto-merge, replaced third-party `auto-update-pr.yml` with first-party `actions/github-script`, removed redundant `delete-merged-branch.yml`, removed unused `gitnexus` devDependency, and upgraded `ui/` dependencies (Vitest 5.1.1), reducing Dependabot alerts from 47 to 1 moderate. (#122)
- **Dimension Safety**: Existing databases keep their vector size; using a model with a different size fails with a clear error explaining how to re-embed. (#101, #119)
- **Global Vectors**: Global vector tables are sized dynamically on first global store and preserved across restarts. (#119)
- **Repository Hygiene**: Enforced LF line endings via `.gitattributes`, migrated `biome.json` to 2.5.14, updated `.husky/pre-commit` for Husky v10 compatibility, and kept `pnpm-lock.yaml` as the single lockfile. (#122)

### Fixed

- **MCP Server**: `serverInfo.version` now reports the version from `package.json` instead of a hardcoded `1.0.0`, and stray `console.log` calls were routed to `console.error` for stdio purity. (#100, #121)
- **MCP Tools**: `memory_store` no longer makes false encryption claims or mutates caller metadata objects; external URI placeholders are marked `is_active = 0` so active queries/exports remain unpolluted. (#100, #121)
- **Build & UI Tests**: `pnpm build` emits `dist/` cleanly; UI tests load jest-dom matchers cleanly under Vitest 5. (#100, #102, #122)

## [1.5.6] - 2026-06-15

### Added

- **Graph UX**: Added "Connected Memories" section to `NodeDetailsPanel` to traverse connected nodes directly.
- **Graph UX**: Added empty state overlay ("No matches found") when search or filter returns no results.
- **Graph UX**: Added `Escape` key handler to quickly clear search input.
- **Responsive UI**: Updated layout of UI overlays to dynamically adapt for mobile screens via CSS media queries.

### Fixed

- **CI Pipeline**: Rebuilt `pnpm-lock.yaml` to fix out-of-sync package specifications that blocked the GitHub Actions CI `test` job.

## [1.5.5] - 2026-06-14

### Fixed

- **Test Coverage**: Achieved 100% line test coverage across both the Root CLI/Server backend and the React UI frontend by adding missing fallback routes tests, typing explicit ignores for OS-specific branches, and covering `NodeDetailsPanel` UI branches.
- **TypeScript Artifacts**: Cleaned up the repository by deleting legacy `ai_auto_annotate.js` and `seed-test-data.js` duplicates outputted by TSC without `noEmit`. Migrated `update-changelog.js` and `show_recent_memories.cjs` to TypeScript (`.ts`) running natively with `tsx`, resolving mixed `.js`/`.ts` confusion.

## [1.5.4] - 2026-06-14

### Changed

- **Test Coverage & Configuration**: Achieved ~49% UI coverage and ~86% root test coverage by adding missing edge case tests for `NodeDetailsPanel` and `MemoryGraph`. Modified `vitest.config.ts` to strictly target `tests/**/*.test.ts` avoiding build artifacts, and added `noEmit: true` to `tsconfig.json` to prevent TS compilation leakage into tests.

## [1.5.3] - 2026-06-14

### Fixed

- **UI Bug Fix**: Resolved missing `isGlobal` variable reference in `MemoryGraph.tsx`.
- **Pre-commit Hooks**: Updated `tsc` command in `.husky/pre-commit` to use `tsc -b` for proper project references evaluation.

## [1.5.2] - 2026-06-14

### Added

- **Pre-commit Hooks**: Implemented `husky` and `lint-staged` with automated Biome format/lint, strict TypeScript `tsc --noEmit` checks, and `vitest` suite verification prior to commits.
- **Dynamic Node Color Scaling**: Node colors in the UI graph (`MemoryGraph.tsx`) now dynamically scale hue based on their `val` (importance) using HSL gradients to intuitively display memory significance.

## [1.5.1] - 2026-06-14

### Added

- **UI Test Coverage**: Added `vitest` and `@testing-library/react` to the `ui/` workspace. Implemented rendering and interaction tests for `MemoryGraph.tsx` and `NodeDetailsPanel.tsx` (Iteration 3).
- **Graph UX Counter**: Added a dynamic `Showing X / Y nodes` counter to `MemoryGraph` when filtering data.

### Changed

- **Node Differentiation**: Modified 3D and 2D canvas materials in `MemoryGraph`. Global nodes are now distinctly colored `#f59e0b` (Orange) and Local nodes `#10b981` (Emerald Green) to allow instant visual domain clustering.

## [1.5.0] - 2026-06-14

### Added

- **Web UI Modernization**: Completely overhauled the `/` dashboard UI with responsive glassmorphism (`backdrop-filter`), beautiful 3D glowing spheres (`THREE.MeshPhysicalMaterial`), and a smooth slide-out `NodeDetailsPanel` for inspecting memory contents without clutter.
- **Exploratory Testing Fixes**: Implemented Quick Filters (All, Global, Local) underneath the search bar to instantly isolate domains.
- **Graph UX**: Added keyboard shortcut `Ctrl+K` to focus search, `Escape` to close details panel, and `Enter` to cycle through search matches with an animated camera transition.
- **Developer Experience**: Added inline 'Copy to Clipboard' actions for Node IDs and Text inside the Details panel.
- **Data Synchronization**: Added a 'Refresh' floating action button to seamlessly fetch the latest database state via `/api/graph` without page reloads.
- **Physics Optimization**: Tuned the underlying D3 Engine to drastically repel nodes (`d3Force('charge').strength(-200)`), solving the common 'hairball' dense-graph issue.

## [1.4.0] - 2026-06-14

### Added

- **Federated Memory Architecture**: Implemented global and local memory federation in database interactions.
- **Dashboard Command**: Added `npm run dashboard` to instantly spin up the server and automatically launch the UI dashboard in the user's default browser.
- **Visual Overhaul**: Complete memory graph overhaul using sprite texts, animated camera transitions, and sidebar details panel.

## [1.3.0] - 2026-06-14

### Added

- Implemented `cognitive-memory setup` CLI command for global IDE auto-discovery. It automatically detects Claude Desktop, Cursor, Antigravity, and Windsurf, and injects the MCP server directly into their global `mcp.json` or `mcp_config.json` configurations.

## [1.2.0] - 2026-06-14

### Added

- Implemented `cognitive-memory init` CLI command to automatically inject autonomous memory behavior (`AGENTS.md` and `SKILL.md`) into NPM user repositories.

## [1.1.29] - 2026-06-14

### Fixed

- Fixed the `auto-create-pr` GitHub Action to properly request `contents: write` permissions so it can successfully enable auto-merge on the PRs it creates.

## [1.1.28] - 2026-06-14

### Added

- Added `auto-create-pr.yml` GitHub Action to automatically generate Pull Requests whenever a new branch is pushed to the repository.

## [1.1.27] - 2026-06-14

### Fixed

- Fixed broken Auto-Update PRs GitHub Action workflow by updating the `actions-pr-auto-update` repository owner from `castastrophe` to `allonsy-studio` after a repository transfer.

## [1.1.26] - 2026-06-14

### Added

- **100% Test Coverage**: Achieved complete 100% test coverage across all `src/` and `src/tools/` modules, including all edge cases, SQLite errors, and filesystem failure paths in `import.ts` and `export.ts`.

## [1.1.25] - 2026-06-14

### Fixed

- Fixed GitHub Packages publication pipeline by granting `packages: write` permissions to GitHub Actions.
## [1.1.24] - 2026-06-14

### Fixed

- Fixed GitHub Packages publication pipeline by dynamically configuring package scope.

## [1.1.23] - 2026-06-09

### Added

- **Agent-to-Obsidian Deletion Propagation**: If the AI agent deletes a memory (via `memory_delete` -> `is_active = 0`), the next `memory_sync` will automatically remove the corresponding `.md` file from the Obsidian vault (unless the human modified the file after the agent deleted it, in which case the human's edit wins and the memory is resurrected).
- **Two-Phase Graph Import**: Eliminated `FOREIGN KEY` race conditions by decoupling node insertion from edge linking during Obsidian synchronization.
- **Sync Deletion Ledger**: Deleting a Markdown file in Obsidian now correctly sets `is_active = 0` in SQLite instead of silently re-creating the file on next sync. Uses a lightweight `.sync_state.json` ledger.
- **Frontmatter Identity Binding**: Implemented decoupling of logical IDs from filenames. Users can now freely rename their memory `.md` files in Obsidian without breaking graph integrity, as the agent parses `id: ...` directly from YAML frontmatter.

## [1.1.22] - 2026-06-09

### Added

- Implemented robust bidirectional synchronization between SQLite database and local Markdown vault (`memory_sync` tool).
- Memory files created or updated in Obsidian (or other Markdown editors) sync directly to the AI's core SQLite schema.
- Added extensive test coverage for `import`, `export`, and `sync` orchestrations (`sync.test.ts`, `import.test.ts`).

### Fixed

- Fixed SQLite timestamps parsing inside `import` for incremental file updates.
- Fixed `sqlite-vec` integer limits by correctly casting `rowid` to `BigInt` when replacing embeddings during sync.
- Fixed FOREIGN KEY constraint violations when edge targets were absent during Obsidian Markdown import.

## [1.1.21] - 2026-06-09

### Added

- Fully achieved 100% line-level test coverage across all tool files and database managers.

### Changed

- Configured Vitest to natively track 100% of source files in coverage calculations by enabling \`coverage.all\`.
- Cleaned up residual Cyrillic comments to enforce English-only standardization.

### Fixed

- Fixed Vitest coverage gaps related to rare edge cases in database normalization and metadata parsing.
- Fixed floating point precision issues in \`sqlite-vec\` caching tests.

## [1.1.20] - 2026-06-09

### Added

- Integrated **Biome** as the universal formatter and linter for the project, replacing ESLint/Prettier.
- Added new NPM scripts: `format`, `lint`, and `check` for blazing-fast code quality enforcement.
- Comprehensive test suite for all MCP tools (`cache`, `db`, `clear`, `consolidate`, `delete`, `export`, `graph`, `search`, `store`).
- `test:coverage` command using `@vitest/coverage-v8` to track line-level coverage.
- Split tsconfig to separate `tsconfig.build.json` for compilation, improving IDE module resolution for tests.

### Changed

- Strict `LF` line endings are now enforced globally to prevent cross-platform CRLF git issues.
- Ran project-wide `biome check --write` to auto-format all TypeScript source files, normalize indentation, and remove unused imports.
- Removed deprecated `all` coverage option from Vitest config.

### Fixed

- **CRITICAL**: Fixed major bug in `consolidate.ts` where the deduplication transaction function was defined but never invoked, meaning records were never pruned or decayed.
- **CRITICAL**: Fixed foreign key violation in `delete.ts` where deleting a memory crashed if it had associated edges (sqlite-vec cascade failure). Edges are now properly cleaned up first.
- **CRITICAL**: Fixed state leak in `clear.ts` where `embedding_cache` was not wiped, leading to inconsistent state between tests.
- Fixed hardcoded table name bug in `consolidate.ts` (attempted to query `related` instead of `edges`).

## [1.1.19] - 2026-06-09

### Added

- Added `bin` field to package.json and shebang to `index.js` for direct `npx` execution.
- Added Knowledge Domains (Namespaces) concept to `ROADMAP.md`.
- Added Ko-fi funding badge and GitHub sponsors configuration.
- Set up GitHub Actions CI workflow and Dependabot configuration.

## [1.1.18] - 2026-06-09

### Changed

- Scope npm package to `@cemised` to prevent registry collision.
- Update repository URL to real github handle.

## [1.1.17] - 2026-06-09

### Docs

- Set package authorship to Eduards Čemis.

## [1.1.16] - 2026-06-09

### Docs

- Add generated hero image to README.

## [1.1.15] - 2026-06-09

### Build

- Add npm package metadata and `files` array targeting `dist/` directory.

## [1.1.14] - 2026-06-09

### Added

- Added automated `CHANGELOG.md` updater script mapped to npm `version` lifecycle.

## [1.1.13] - 2026-06-09

### Changed

- Enriched `ROADMAP.md` with detailed architectural explanations for Temporality and Background Daemon.

## [1.1.12] - 2026-06-09

### Changed

- Refactored Obsidian export (`src/tools/export.ts`): Switched to individual Obsidian notes per memory.
- Added explicit Markdown Wikilinks (`[[Memory_ID]]`) mapping database edges to true Obsidian Graph View edges.

## [1.1.11] - 2026-06-09

### Added

- Created `ROADMAP.md` outlining future architectural enhancements (Temporal Graphs, Multi-hop reasoning, Paged Memory, Background Consolidation, Verbatim Episodic Memory).

## [1.1.10] - 2026-06-09

### Added

- Added "Human-Agent Cognitive Symmetry" concept to `README.md` as our absolute unique value proposition.

## [1.1.9] - 2026-06-09

### Changed

- Massively rewrote `README.md` to Enterprise Open Source Standard (added architecture sections, MCP tools reference).

## [1.1.8] - 2026-06-09

### Added

- Optimized GitHub Actions CI pipeline and integrated `SECURITY.md`.

## [1.1.7] - 2026-06-08

### Added

- Formatted repository for Open Source release: added `CONTRIBUTING.md`, Issue Templates, and initial CI workflow.

## [1.1.6] - 2026-06-08

### Changed

- Modified `gitnexus` script in `package.json` to include `--skip-skills` and `--skip-agents-md` flags.

## [1.1.5] - 2026-06-08

### Removed

- Removed `.claude/skills` directory and redundant auto-generated claude skills from repository tracking.

## [1.1.4] - 2026-06-08

### Changed

- Updated `AGENTS.md` and GitNexus rules for better AST synchronization.

## [1.1.3] - 2026-06-08

### Fixed

- Added `pnpm.onlyBuiltDependencies` for `better-sqlite3`, `sqlite-vec`, and `esbuild` to `package.json` to fix native compilation issues.

## [1.1.2] - 2026-06-08

### Changed

- Switched repository license from MIT to Apache-2.0 to provide enterprise patent protection.

## [1.1.1] - 2026-06-08

### Added

- Implemented `vitest` test suite with in-memory SQLite and mocked Ollama responses.

## [1.1.0] - 2026-06-08

### Fixed

- Disabled dangerous JSDoc generation in pre-commit hooks to prevent file corruption.
- Fixed index imports for MCP server.

## [1.0.0] - 2026-06-08

### Added

- Implemented `sqlite-vec` integration for local vector storage, replacing the previous external database architecture.
- Added direct Ollama integration via native `fetch` for embedding generation (`nomic-embed-text`) and text generation (`llama3.2`).
- Created autonomous AI Auto-Documenter in the `pre-commit` hook that automatically generates inline JSDoc and semantic Markdown annotations for all modified `.ts` files prior to commit.
- Added asynchronous GitNexus AST indexing to the `post-commit` hook to continuously update codebase intelligence.
- Introduced bidirectional Obsidian vault synchronization via `src/tools/export.ts`.

### Changed

- Migrated entirely from SurrealDB to `better-sqlite3`.
- Updated all test suites and helper scripts to utilize the new SQLite schemas and logic.
- Optimized tool descriptions in `src/index.ts` to reflect the new architecture and drop references to legacy cloud databases.

### Removed

- Removed legacy SurrealDB connection files and test scripts (`clean_db.js`, `dump_db.js`, `test_connect.js`).
- Removed deprecated daemon scripts (`src/starter.ts`).
- Cleaned up root directory from old chat dumps, python extractors, and legacy debug artifacts.
- Removed redundant `CLAUDE.md` and `CONTEXT_HANDOFF.md` files as `AGENTS.md` acts as the single source of truth for the workspace.
