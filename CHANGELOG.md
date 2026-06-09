# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
