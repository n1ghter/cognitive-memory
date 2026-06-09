**Semantic Summary**
======================

The `src/index.ts` file sets up a high-performance bridge for the Model Context Protocol (MCP). It creates an instance of the `McpServer` class with a specific name and version.

The server exposes several tools for managing semantic memories, including:

*   **Memory Store**: Encrypts, hashes, vectorizes, and persists memories into a local SQLite database.
*   **Memory Search**: Performs optimized vector similarity cosine searches on stored memories.
*   **Memory Delete**: Deletes a specific memory record by its identifier.
*   **Memory Clear All**: Completely wipes all memories from the database (nuclear option).
*   **Memory Consolidate**: Performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
*   **Memory Relate**: Establishes a graph relationship between two memory nodes.
*   **Memory Export**: Exports active database memories into Markdown notes for Obsidian integration.

The server is initialized using the `bootstrap` function, which sets up the database manager and connects to the MCP protocol.

**Notes**
--------

This code provides a critical performance enhancement by redirecting stdout logging to stderr, ensuring safe transport of JSON-RPC message packets. The tools defined in this file are designed to work together seamlessly, providing a robust framework for managing semantic memories.