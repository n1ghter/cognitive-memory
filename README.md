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

A high-performance, local-first **Model Context Protocol (MCP)** server that provides AI agents with persistent cognitive memory.

Unlike cloud-based memory solutions, Cognitive Memory runs entirely on your local machine using SQLite and local LLM embeddings. This ensures **zero latency, zero API costs, and absolute data privacy** — making it ideal for enterprise and personal environments.

---

## 🌟 Why We Are Unique: Human-Agent Cognitive Symmetry

Most AI memory platforms (like Graphiti, Letta, Cognee) lock the AI's "brain" inside opaque databases (Neo4j, ChromaDB, Pickles). If the AI remembers something incorrectly, it becomes a "black box" that is difficult for a human to debug or edit.

**Cognitive Memory** pioneers **Bi-directional Human-Agent Symmetry**:
We bridge the gap between an AI's Long-Term Memory and a human's Second Brain. The AI's memory is simply a collection of interconnected Markdown files in an Obsidian vault. 
- **Read:** You can open Obsidian and visually read what the agent is thinking.
- **Edit:** You can delete or modify a markdown file, and the agent's memory instantly updates.
- **Write:** You can write your own notes, and the agent natively understands them via Vector+Graph search.

## ✨ Features

- **Semantic LTM**: Stores and retrieves long-term declarative memories using Cosine Similarity vector search.
- **Local Vectors**: Uses `sqlite-vec` and `better-sqlite3` for blazing-fast local vector operations.
- **Local Embeddings**: Integrates directly with Ollama (`qwen3-embedding:8b`) to generate 4096-dimensional embeddings locally without hitting external APIs.
- **Hybrid Graph Relations**: Connects memories together to form an explicit, interconnected knowledge graph.
- **Obsidian Sync**: Bidirectional synchronization with local Markdown vaults (e.g., Obsidian). Manually edit `.md` memory files, and the changes sync back to SQLite.
- **Code Intelligence**: Integrates **GitNexus** via a Git `post-commit` hook to asynchronously update the AST knowledge graph for deep codebase intelligence.

## 🚀 Installation & Setup

We recommend a simple 2-step process to get Cognitive Memory fully integrated into your workflow.

### Prerequisites
- Node.js (v24+ recommended)
- `pnpm` (v9+)
- [Ollama](https://ollama.com/) running locally on port `11434` with the following models pulled:
  ```bash
  ollama pull qwen3-embedding:8b
  ollama pull llama3.2
  ```

### Step 1: Global Editor Setup (The "Hands")
To give your AI Assistant access to the database tools, run the global setup script. This auto-detects your installed AI Editors (Antigravity, Cursor, Claude Desktop, Claude Code, Copilot, Windsurf, OpenCode) and injects the MCP server directly into their global JSON/TOML configuration files:

```bash
npx -y @cemised/cognitive-memory setup
```

### Step 2: Local Project Initialization (The "Brain")
Having the tools is not enough; the AI needs to know *when* and *how* to use them autonomously. Navigate to your project folder and run the initialization script to inject the `AGENTS.md` memory forcing-function checklist and the auto-capture `SKILL.md`:

```bash
cd my-project
npx -y @cemised/cognitive-memory init
```

*Note: You only need to run Step 1 once per machine. You should run Step 2 for every new codebase you want your AI to memorize.*

## 💻 Manual MCP Configuration (Optional)

If you prefer not to use the `setup` script, you can manually add the following to your client's MCP configuration file (e.g. `mcp_config.json`):

```json
{
  "mcpServers": {
    "cognitive-memory": {
      "command": "npx",
      "args": [
        "-y",
        "@cemised/cognitive-memory"
      ]
    }
  }
}
```

### Build from Source (For Developers)
If you want to modify the source code or if your environment requires compiling native C++ bindings for SQLite manually:

```bash
git clone <repository-url>
cd cognitive-memory
pnpm install
pnpm rebuild  # Crucial for native SQLite C++ bindings
pnpm run build
```

Then configure your MCP client to point to the local build instead:

```json
{
  "mcpServers": {
    "cognitive-memory": {
      "command": "node",
      "args": [
        "/absolute/path/to/cognitive-memory/dist/index.js"
      ]
    }
  }
}
```

### Exposed AI Tools
Once connected, the server exposes 8 powerful tools to your AI agent:
- `memory_store`: Encrypt/Hash, vectorize, and persist a semantic memory into a local SQLite database.
- `memory_sync`: Perform a bidirectional synchronization between local Obsidian Markdown files and the SQLite database.
- `memory_relate`: Establish a graph relationship between two memory nodes.
- `memory_search`: Perform optimized vector similarity cosine searches on stored memories.
- `memory_export`: Export active database memories into Markdown notes for Obsidian integration.
- `memory_consolidate`: Perform time decay and semantic LLM merging/deduplication on active memories using Ollama.
- `memory_delete`: Delete a specific semantic memory record by its identifier.
- `memory_clear_all`: NUCLEAR OPTION: Completely wipe all memories, vectors, and graph edges from the database. Cannot be undone.

## 🏗️ Architecture

The project adheres to a clean modular architecture:
- `src/db.ts`: Manages the SQLite connection, schema, and vector extensions.
- `src/ollama.ts`: Lightweight native fetch wrapper for the Ollama API.
- `src/cache.ts`: Caches embeddings to avoid recalculating identical strings.
- `src/tools/`: Contains the business logic for the MCP endpoints.

## 🤝 Contributing & Community

We welcome community contributions, from bug fixes to new features! 
- Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started.
- Review our [Security Policy](SECURITY.md) for vulnerability reporting.

## 📄 License

This project is licensed under the [Apache 2.0 License](LICENSE). This provides strong patent protection and makes the project safe for enterprise adoption.

---

**Author / Creator:**  
[Eduards Čemis](https://www.linkedin.com/in/cemised/)

## 💖 Support the Project

If you find this project helpful and want to support its continued development, consider buying me a coffee! ☕

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V5Z6212C4G)
