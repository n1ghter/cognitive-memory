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

> 📖 **Architecture & 2026 Research:** See [docs/RESEARCH_2026.md](docs/RESEARCH_2026.md), [docs/ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md), [ROADMAP.md](ROADMAP.md), and the [Project Wiki](https://github.com/n1ghter/cognitive-memory/wiki).

---

## ✨ Key Capabilities

- **Cross-Tool Portability:** One memory store usable simultaneously from Antigravity, Claude Code, Claude Desktop, Cursor, Windsurf, Copilot, and OpenCode (`npx -y @cemised/cognitive-memory setup`).
- **Federated Scopes (`local` | `global` | `all`):** Isolate project-specific context in `./memory.sqlite` while sharing user-wide preferences and patterns via `~/.cognitive-memory/global-memory.sqlite`.
- **3-Tier Memory Profiles (`user` | `working` | `agent_core`):** Keep stable preferences, active debugging context, and invariant architectural facts cleanly separated.
- **Zero-Copy External Grounding:** Attach validated `ref` pointers (`vault_path`, `wikilink`, `source_hash`, `section`) and external `grounded_in` / `references` graph edges (`obsidian://`, `vault://`) back to canonical Markdown files.
- **Human-Agent Symmetry (Obsidian Sync):** Bidirectional Markdown export/import with YAML frontmatter so you can read, edit, diff, and version-control what your agents remember.
- **Resilient Engine & Hardened Transports:** Stdio transport by default plus loopback-first SSE mode (with localhost CORS and timing-safe Bearer auth for remote/Docker deployments), Ollama timeouts, O(1) bounded LRU cache, single-pass CTE vector search, and exact content deduplication.
- **Eval-Driven Development:** Built-in `evals/` benchmark suite measuring `Recall@K`, `Hit@1`, `MRR`, `nDCG@K`, negative abstention, and deduplication accuracy in CI.

---

## 🚀 Quick Start

### Prerequisites
- Node.js **v24+**
- `pnpm` **v9+** (for building from source)
- [Ollama](https://ollama.com/) running locally on port `11434` *(required for dense vector embeddings in v1.x; optional hybrid layer in upcoming v2.0)*:
  ```bash
  ollama pull qwen3-embedding:8b
  ollama pull llama3.2
  ```
  Set `EMBEDDING_MODEL` to use any Ollama embedding model — vector tables are dynamically sized to your model's dimension.

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
| `memory_search` | Semantic search with optional `scope` (`local` \| `global` \| `all`), `profile` (`user` \| `working` \| `agent_core` \| `all`), `limit`, and `threshold`. |
| `memory_store` | Store a memory with exact deduplication, optional `scope` (`local` \| `global`), `profile`, `importance`, and zero-copy `metadata.ref` pointers. |
| `memory_relate` | Create a typed graph edge between two memory nodes or link a memory to an external `obsidian://` / `vault://` URI (`grounded_in`, `references`). |
| `memory_sync` | Bidirectional sync between local Markdown/Obsidian notes and SQLite. |
| `memory_export` | Export active memories and graph relations to Markdown files. |
| `memory_consolidate` | Time-decay importance scoring and near-duplicate merging. |
| `memory_delete` | Soft-delete (default) or hard-purge a specific memory record. |
| `memory_clear_all` | Wipe all local memories, vectors, and edges (`confirm: true` required). |

---

## 🧪 Verification Harness & Evals

Every change is verified through a single local & CI harness command:

```bash
pnpm install
pnpm rebuild better-sqlite3 sqlite-vec
pnpm verify          # Biome + tsc + build + unit tests + offline eval gate + UI build & tests
```

Run retrieval scorecards directly:
```bash
pnpm eval                      # real embeddings via local Ollama
pnpm eval:ci                   # deterministic offline hash baseline (no Ollama required)
pnpm eval -- --k 3 --json report.json
```

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
- `docs/` — 2026 empirical research memo (`RESEARCH_2026.md`) and v2.0 architecture (`ARCHITECTURE_V2.md`).
- `ui/` — Optional React + Three.js force-graph dashboard (maintenance-only).

---

## 🤝 Contributing & License

- Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening a PR.
- Licensed under the [Apache 2.0 License](LICENSE).

**Author:** [Eduards Čemis](https://www.linkedin.com/in/cemised/)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V5Z6212C4G)
