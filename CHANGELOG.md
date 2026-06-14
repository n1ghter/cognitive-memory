# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
