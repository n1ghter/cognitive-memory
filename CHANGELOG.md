# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.1.13] - 2026-06-09

### Added
- Created `ROADMAP.md` outlining future architectural enhancements (Temporal Graphs, Multi-hop reasoning, Paged Memory, Background Consolidation, Verbatim Episodic Memory) based on competitive analysis.

### Changed
- Migrated default embedding model to `qwen3-embedding:8b` (SOTA for multilingual contexts).
- Updated `sqlite-vec` database schema to expect `4096`-dimensional vectors (previously `768`).

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
