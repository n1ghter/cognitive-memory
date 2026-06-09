### Semantic Summary for `src/index.ts`

#### Why (Business Logic and Architectural Purpose)

This file is the main entry point for a high-performance bridge that integrates with the Model Context Protocol (MCP). It sets up a `McPServer` instance, defines various tools for memory management, and establishes connections to an Obsidian vault directory.

The tools defined in this file are:

*   `memory_store`: Encrypts, hashes, vectorizes, and persists semantic memories into a local SQLite database.
*   `memory_search`: Performs optimized vector similarity cosine searches on stored memories.
*   `memory_delete`: Deletes a specific semantic memory record by its identifier.
*   `memory_consolidate`: Performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
*   `memory_relate`: Establishes a graph relationship between two memory nodes.
*   `memory_export`: Exports active database memories into Markdown notes for Obsidian integration.

These tools are designed to provide efficient and secure management of semantic memories, enabling the bridge to serve as a robust and scalable platform for knowledge management applications.