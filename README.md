# Cognitive Memory MCP Server

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Testing](https://img.shields.io/badge/Tested_with-Vitest-yellow.svg)](https://vitest.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

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

### Prerequisites
- Node.js (v24+ recommended)
- `pnpm` (v9+)
- [Ollama](https://ollama.com/) running locally on port `11434` with the following models pulled:
  ```bash
  ollama pull qwen3-embedding:8b
  ollama pull llama3.2
  ```

### Build from Source
```bash
git clone <repository-url>
cd cognitive-memory
pnpm install
pnpm rebuild  # Crucial for native SQLite C++ bindings
pnpm run build
```

## 💻 Usage (MCP Client Configuration)

To use this server with an MCP-compatible client (like Claude Desktop, Cursor, or custom AI agents), add the following to your client's MCP configuration JSON:

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
Once connected, the server exposes several tools to your AI agent, including:
- `memory_store`: Save a new fact or concept into long-term memory.
- `memory_search`: Perform a semantic vector search for related memories.
- `memory_delete`: Remove obsolete information.
- `memory_relate`: Create a graph edge between two existing memories.

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
