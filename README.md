# Cognitive Memory MCP Server

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![NPM Version](https://img.shields.io/npm/v/@cemised/cognitive-memory.svg)](https://www.npmjs.com/package/@cemised/cognitive-memory)
[![CI](https://img.shields.io/github/actions/workflow/status/n1ghter/cognitive-memory/ci.yml?branch=main&label=CI)](https://github.com/n1ghter/cognitive-memory/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Testing](https://img.shields.io/badge/Tested_with-Vitest-yellow.svg)](https://vitest.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Support me on Ko-fi](https://img.shields.io/badge/Support_me_on-Ko--fi-ff5f5f.svg?logo=ko-fi&logoColor=white)](https://ko-fi.com/cemised)

<p align="center">
  <img src="assets/hero.png" alt="Cognitive Memory Architecture" width="800">
</p>

**A vendor-neutral, local-first MCP memory engine shared across all your AI coding tools.**

Native auto-memory in Claude Code, Cursor, Antigravity, and Windsurf locks your project knowledge inside each tool's silo. **Cognitive Memory** provides one portable, inspectable, local memory layer across every MCP-compatible agent — combining fast SQLite storage, federated project + global scopes, zero-copy Obsidian/Markdown pointers, and an automated retrieval eval harness.

> 📖 **Architecture, ADRs & Collaboration:** [docs/RESEARCH_2026.md](docs/RESEARCH_2026.md) · [docs/ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md) · [ADRs](docs/adr/README.md) · [ROADMAP.md](ROADMAP.md) · [Project Board](https://github.com/users/n1ghter/projects/1) · [Wiki](https://github.com/n1ghter/cognitive-memory/wiki) · [Milestones](https://github.com/n1ghter/cognitive-memory/milestones) · [Discussions](https://github.com/n1ghter/cognitive-memory/discussions)

---

## ✨ Key Capabilities (v2.0)

- **Zero-Ollama by Default (SQLite FTS5 BM25 + Optional Hybrid RRF):** Works out of the box with zero external services (`EMBEDDING_PROVIDER=none` or automatic offline fallback). When local Ollama is running, seamlessly upgrades to **Hybrid Reciprocal Rank Fusion (BM25 + `sqlite-vec` cosine)** — beating both pure lexical and pure vector baselines.
- **Markdown-First Canonical Truth (`memory_reindex` / `cognitive-memory reindex`):** Bidirectional Obsidian/Markdown sync with YAML frontmatter (`profile`, `status`, `valid_from`, `valid_until`, `superseded_by`) and lossless zero-Ollama index reconstruction from Markdown notes.
- **Temporal Supersession & Bounded 1–2 Hop Graph:** Pass `supersedes` on `memory_store` so updated facts cleanly replace outdated ones (`100%` contradiction resolution, `0%` stale leaks) while preserving history (`includeSuperseded: true`). Enable `includeGraph: true` (`graphDepth: 1 | 2`) to fetch directly linked context and external `grounded_in` pointers in a single call.
- **Cross-Tool Portability:** One memory store usable simultaneously from Antigravity, Claude Code, Claude Desktop, Cursor, Windsurf, Copilot, and OpenCode (`npx -y @cemised/cognitive-memory setup`).
- **Federated Scopes (`local` | `global` | `all`) & 3-Tier Profiles (`user` | `working` | `agent_core`):** Isolate project context while sharing user-wide conventions globally.
- **Zero-LLM "Auto Dream" Consolidation:** Time-decay pruning and conflict-guarded lexical deduplication that run with zero LLM required (optionally upgrading to Ollama synthesis when online).
- **Hardened Transports & Continuous Eval Harness:** Stdio default + loopback-first SSE mode (localhost CORS, timing-safe Bearer auth required for remote bind), plus `pnpm verify` and `evals/` benchmarking BM25 vs. Vector vs. Hybrid RRF, distractor noise, and temporal contradictions.

---

## 🚀 Quick Start

### Prerequisites
- Node.js **v24+**
- `pnpm` **v9+** (for building from source)
- **Optional** [Ollama](https://ollama.com/) on port `11434` to enable dense hybrid embeddings & LLM consolidation synthesis (completely optional — set `EMBEDDING_PROVIDER=none` for explicit lexical-only mode, or leave default `auto` for automatic fallback):
  ```bash
  ollama pull qwen3-embedding:8b
  ollama pull llama3.2
  ```

### 1. Connect Your AI Editors (Once Per Machine)
Auto-detects installed editors (Antigravity, Cursor, Claude Desktop, Claude Code, Copilot, Windsurf, OpenCode) and adds the MCP server config:
```bash
npx -y @cemised/cognitive-memory setup
```

### 2. Initialize a Project (Optional)
```bash
cd my-project
npx -y @cemised/cognitive-memory init
```

### Manual MCP Configuration
```json
{
  "mcpServers": {
    "cognitive-memory": {
      "command": "npx",
      "args": ["-y", "@cemised/cognitive-memory"]
    }
  }
}
```

### Docker / Local HTTP SSE Mode
```bash
MCP_AUTH_TOKEN="your-secret-token" docker compose up -d
```
By default `--sse` binds strictly to `127.0.0.1:3000`. Binding to a non-loopback host (`MCP_HOST=0.0.0.0`) requires `MCP_AUTH_TOKEN`.

---

## 🛠️ Exposed MCP Tools

| Tool | Purpose |
|---|---|
| `memory_search` | Hybrid FTS5 BM25 + optional dense RRF search (`mode: hybrid \| bm25 \| vector`), `scope` (`local` \| `global` \| `all`), `profile`, `includeSuperseded`, and bounded 1–2 hop `includeGraph` (`graphDepth: 1 \| 2`). |
| `memory_store` | Store a memory (zero-Ollama safe) with exact deduplication, `scope`, `profile`, `importance`, zero-copy `metadata.ref` pointers, and `supersedes` temporal versioning. |
| `memory_relate` | Create a typed graph edge between two memory nodes or link a memory to an external `obsidian://` / `vault://` URI (`grounded_in`, `references`). |
| `memory_sync` | Bidirectional sync between local Markdown/Obsidian notes and SQLite. |
| `memory_export` | Export memories (active or `includeSuperseded: true`) and graph relations to Markdown files. |
| `memory_reindex` | Wipe and rebuild the local SQLite FTS5 + optional vector index losslessly from canonical Markdown files (`cognitive-memory reindex`). |
| `memory_consolidate` | "Auto Dream" time-decay pruning and near-duplicate merging (zero-LLM fallback or optional Ollama synthesis). |
| `memory_delete` | Soft-delete (default) or hard-purge a specific memory record. |
| `memory_clear_all` | Wipe all local memories, vectors, and edges (`confirm: true` required). |

---

## 🧪 Verification Harness & Evals

Every change is verified through a single local & CI harness command:

```bash
pnpm install
pnpm rebuild better-sqlite3 sqlite-vec
pnpm verify          # Biome + tsc + build + 116 root tests & eval gates + UI build & 23 UI tests
```

Run retrieval scorecards directly:
```bash
pnpm eval                                          # live Hybrid RRF via local Ollama
pnpm eval:ci                                       # deterministic offline hash baseline
npx tsx evals/run.ts --embedder none --mode bm25   # pure zero-Ollama SQLite FTS5 BM25
npx tsx evals/run.ts --embedder hash --mode compare --noise 60
```

**Deterministic Offline Benchmark (`k=5`, 26 memories, 28 queries, 4 temporal contradictions, 8 dedup pairs):**

| Mode | Recall@5 | Hit@1 | MRR | nDCG@5 | Default-Threshold Recall | Neg Abstention | Contradictions@1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `bm25` (zero-Ollama) | 81.3% | 66.7% | 71.9% | 73.1% | 60.4% | 100.0% | 100.0% (0% leak) |
| `vector` (hash baseline) | 81.3% | 70.8% | 74.8% | 75.3% | 14.6% | 100.0% | 100.0% (0% leak) |
| **`hybrid` (BM25 + RRF)** | **85.4%** | **70.8%** | **76.2%** | **77.3%** | **60.4%** | **100.0%** | **100.0% (0% leak)** |

Optional read-only 3D Graph Explorer:
```bash
pnpm dashboard                 # launches local Web UI at http://localhost:3000
```

---

## 🏗️ Project Layout

- `src/db.ts` — SQLite connection manager, federated `main` + `global` schemas, dynamic `sqlite-vec` tables.
- `src/cache.ts` — O(1) bounded LRU L1 + SQLite L2 embedding cache.
- `src/ollama.ts` — Timeout-hardened native `fetch` client for Ollama.
- `src/tools/` — Core MCP tool implementations (`search`, `store`, `graph`, `sync`, `export`, `import`, `consolidate`, `delete`, `clear`).
- `src/cli/` — `setup` (multi-editor config injection) and `init` (project templates).
- `evals/` — Golden dataset and deterministic/live retrieval scorecard runner.
- `docs/` — 2026 empirical research memo (`RESEARCH_2026.md`), v2.0 architecture (`ARCHITECTURE_V2.md`), and Architecture Decision Records (`docs/adr/`).
- `ui/` — Optional React + Three.js force-graph dashboard (maintenance-only).

---

## 🤝 Contributing & License

- Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening a PR.
- Licensed under the [Apache 2.0 License](LICENSE).

**Author:** [Eduards Čemis](https://www.linkedin.com/in/cemised/)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V5Z6212C4G)
