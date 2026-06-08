# Cognitive Memory MCP Server

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Testing](https://img.shields.io/badge/Tested_with-Vitest-yellow.svg)](https://vitest.dev/)

A high-performance, local-first Model Context Protocol (MCP) server that provides AI agents with persistent cognitive memory.

Unlike cloud-based memory solutions, Cognitive Memory runs entirely on your local machine using SQLite and local LLM embeddings, ensuring zero latency and maximum privacy.

## Features

- **Semantic Memory**: Stores and retrieves memories using Cosine Similarity vector search.
- **Local Vectors**: Uses `sqlite-vec` and `better-sqlite3` for blazing-fast local vector operations.
- **Local Embeddings**: Integrates directly with Ollama (`qwen3-embedding:8b`) to generate 4096-dimensional embeddings without hitting external APIs.
- **Graph Relations**: Connects memories together to form a rich, interconnected knowledge graph.
- **Obsidian Sync**: Bidirectional synchronization with local Markdown vaults (e.g., Obsidian). You can manually edit `.md` memory files, and the changes sync back to SQLite.
- **Autonomous Auto-Documenter**: Features a custom Git `pre-commit` hook that automatically injects JSDoc and generates semantic architecture annotations (`knowledge/annotations/`) using local AI.
- **GitNexus Integration**: Features a Git `post-commit` hook that asynchronously updates the AST knowledge graph for deep codebase intelligence.

## Prerequisites

- Node.js (v24+ recommended)
- `pnpm`
- Ollama (running locally on port `11434` with the `qwen3-embedding:8b` and `llama3.2` models)

## Installation

```bash
pnpm install
pnpm run build
```

## Architecture

The project uses a clean modular architecture:
- `src/db.ts`: Manages the SQLite connection and schema.
- `src/ollama.ts`: Light, native fetch wrapper for Ollama API (no heavy SDKs).
- `src/cache.ts`: Caches embeddings to avoid recalculating identical strings.
- `src/tools/`: Contains the actual MCP tools (`store`, `search`, `delete`, `export`, etc.).
- `knowledge/annotations/`: Auto-generated semantic RAG documentation.

## License

[Apache 2.0](LICENSE)
