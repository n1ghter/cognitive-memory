# ADR 0003: Temporal Supersession & Bounded 1–2 Hop Subgraph Retrieval

- **Status:** Accepted
- **Date:** 2026-11-25
- **Related:** Issues `#132`, `#136`, PR `#138`

## Context

Two recurring failure modes plague agent memory systems:

1. **Contradiction & Stale Facts:** When a decision changes (e.g., migrating from SurrealDB to SQLite, or changing a port from `8080` to `8443`), naive append-only vector stores return both old and new facts side by side, causing agents to act on outdated truths.
2. **Unbounded Graph / Grep Loops:** Returning flat text forces multi-turn `grep → read` exploration loops, while unbounded graph traversal explodes context windows with weakly related noise.

## Decision

1. **Temporal validity & explicit supersession:**
   - Add `valid_from`, `valid_until`, and `superseded_by` columns to `memory` tables across `main` and `global` schemas.
   - Support `supersedes` on `memory_store`: atomically marks the superseded memory with `valid_until` and `superseded_by`, creates a `supersedes` graph edge, and excludes superseded rows from default `memory_search` and `memory_export`.
   - Preserve full auditability via `includeSuperseded: true` on `memory_search` and `memory_export`, and round-trip temporal metadata through Markdown YAML frontmatter.
2. **Bounded 1–2 hop CTE subgraph expansion:**
   - Support optional `includeGraph: true` with `graphDepth: 1 | 2` (hard-capped at 2 hops) in `memory_search` using a recursive SQLite CTE.
   - Return connected active memories and external `grounded_in` / `references` URI pointers in a single MCP tool call.
3. **Zero placeholder pollution:**
   - External URI targets (`obsidian://`, `vault://`) stored for FK integrity use `is_active = 0` so they appear in explicit graph relations without polluting active search, export, or consolidation queries.

## Consequences

- **Positive:** Temporal contradiction benchmark achieves `100% resolved@1` and `0% stale leak`; single-call structural retrieval avoids repetitive agent tool loops while staying strictly token-bounded.
- **Trade-off:** Callers must pass `supersedes` (or edit canonical Markdown frontmatter) to mark replacements explicitly; future hooks (`v2.1.0`) will assist with automatic supersession detection.

## Verification

- `tests/temporal_reindex.test.ts` and contradiction tracks in `evals/run.ts`.
