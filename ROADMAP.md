# Cognitive Memory Roadmap (2026–2027)

> Grounded in 2026 empirical memory & agent harness research — see [docs/RESEARCH_2026.md](docs/RESEARCH_2026.md) and [docs/ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md).

Our focus is building a **vendor-neutral, cross-tool, Markdown-first, zero-Ollama hybrid memory layer** for developers who work across multiple AI coding environments (Claude Code, Cursor, Antigravity, Windsurf, Codex, Cline).

---

## ✅ v1.6.0 — Stabilization, Security & Harness Foundation
- [x] Federated `local` / `global` / `all` memory scope with model-sized global vector tables (`#119`)
- [x] Isolated `:memory:` global DB in test suite (zero pollution of `~/.cognitive-memory`) (`#119`)
- [x] Engine hardening: Ollama timeouts, O(1) bounded LRU cache, single-pass CTE cosine search, exact content deduplication, zero-copy `ref` pointers, external URI relations, 3-tier memory profiles (`#121`, co-authored with `@include9it`)
- [x] Hardened SSE transport (loopback default, localhost CORS, timing-safe Bearer auth for remote bind) (`#121`)
- [x] Full-stack CI (`ci.yml`), tag-verified `release.yml`, unified `pnpm verify` harness, zero root security alerts (`#122`)

---

## ✅ v2.0.0 — Zero-Ollama Hybrid Engine & Markdown-First Storage

### Milestone 2.0a: Zero-Dependency Hybrid Retrieval (`FTS5` + Optional Dense RRF)
- [x] **SQLite FTS5 (BM25) Index:** Always-on lexical search across `main` and `global` schemas with zero external dependencies (`#129`, `#137`).
- [x] **Graceful Zero-Ollama Mode:** `memory_store` and `memory_search` work reliably even when Ollama is offline or `EMBEDDING_PROVIDER=none` (`#129`, `#137`).
- [x] **Hybrid RRF Fusion:** Reciprocal Rank Fusion combining BM25 + optional dense embeddings (`sqlite-vec`), verified to beat both pure BM25 and pure vector baselines in `evals/` (`#130`, `#137`).
- [x] **Expanded Eval Harness:** Benchmark `bm25` vs. `dense` vs. `hybrid-rrf`, distractor noise stress tests, and automated CI regression floors (`#130`, `#137`).

### Milestone 2.0b: Markdown-First Truth, Temporal Graph & Auto-Dream
- [x] **Markdown-First Canonical Store & `reindex` CLI:** Treat Markdown/Obsidian notes (+ Git) as canonical truth; SQLite is completely rebuildable via `cognitive-memory reindex` / `memory_reindex` (`#131`, `#138`).
- [x] **Temporal Supersession:** `valid_from`, `valid_until`, and `superseded_by` columns + `supersedes` relation so updated facts cleanly replace stale ones (`100% resolved@1`, `0% stale leak`) (`#132`, `#138`).
- [x] **Zero-LLM Consolidation ("Auto Dream"):** Conflict-guarded lexical deduplication + decay pruning working without Ollama, with optional LLM synthesis when online (`#136`, `#138`).
- [x] **Bounded 1–2 Hop CTE Subgraph Retrieval:** Optional `includeGraph` (`graphDepth: 1 | 2`) in `memory_search` returning connected memories and `grounded_in` external pointers in one tool call (`#136`, `#138`).

---

## 🔭 v2.1.0 — Cross-Tool Portability & Anti-Smell Harness Integration
- [ ] **Minimal Anti-Smell `init` Templates:** Replace verbose `AGENTS.md` checklists with concise, high-compliance prescriptive templates.
- [ ] **Cross-Tool Memory Bridges (`setup` + Importers):** Sync and import memories seamlessly across Claude Code (`MEMORY.md`), Cursor, Windsurf, Antigravity, Codex, and Cline.
- [ ] **Streamable HTTP Local Daemon:** Upgrade HTTP mode to MCP Streamable HTTP (`StreamableHTTPServerTransport`) so multiple local IDEs share one warm daemon cleanly.
- [ ] **Pluggable Embedders:** Support local Ollama, OpenAI-compatible endpoints, or lightweight local ONNX models as optional hybrid accelerators.

---

## 🧊 Frozen / Maintenance-Only
- **3D Web UI Dashboard (`ui/`):** Kept functional and tested in CI as an optional read-only graph explorer, but no new Three.js/WebGL features are planned so engineering effort stays focused on retrieval accuracy, storage integrity, and cross-tool portability.
