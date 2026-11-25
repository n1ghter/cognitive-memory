---
name: memory-auto-capture
description: "Autonomous local-first memory management skill using cognitive-memory MCP (SQLite FTS5 BM25 + optional Hybrid RRF, temporal supersession, Markdown-first canonical storage). Works completely offline without Ollama."
---

# Memory Auto-Capture Skill (`cognitive-memory` v2.0)

Manage durable project and user knowledge via the `cognitive-memory` MCP server without bloating static instructions.

## 1. On-Demand Retrieval

Query memory when past decisions, preferences, or resolved errors matter:

```json
{
  "query": "<concise_query>",
  "mode": "hybrid",
  "scope": "all",
  "limit": 5
}
```
Use `includeGraph: true` (`graphDepth: 1`) when you also need linked context or `grounded_in` raw-source pointers.

## 2. Capture Durable Decisions & Fixes

Store atomic, high-signal facts immediately when architecture decisions, conventions, or non-obvious bug fixes are confirmed:

```json
{
  "text": "<atomic fact and rationale>",
  "scope": "local",
  "profile": "agent_core",
  "importance": 0.8
}
```
Use `scope: "global"` with `profile: "user"` for cross-project user preferences.

## 3. Temporal Supersession (Never Leave Stale Contradictions)

When a decision changes (e.g., migrating databases, changing ports or tooling), supersede the old memory atomically instead of creating a conflicting duplicate:

```json
{
  "text": "<new authoritative fact>",
  "supersedes": "<old_memory_uuid>",
  "importance": 0.9
}
```

## 4. Maintenance

- Run `memory_consolidate` periodically (works deterministically offline via zero-LLM Auto Dream).
- Run `memory_export` / `memory_sync` / `memory_reindex` to keep Markdown notes and SQLite in sync.
