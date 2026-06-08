**Semantic Summary**
=====================

The `src/index.ts` file sets up a high-performance bridge for a cognitive memory application using the MCP (Memory Capture Protocol) standard. It creates a new instance of the `McpServer` with a specific name and version, and defines several tools to interact with the underlying database.

**Business Logic**
-----------------

* Redirects stdout logging to stderr to ensure safe transport of JSON-RPC message packets.
* Establishes a local SQLite database for storing semantic memories, using the `executeMemoryStore`, `executeMemorySearch`, `executeMemoryDelete`, `executeMemoryConsolidate`, `executeMemoryRelate`, and `executeMemoryExport` tools.

**Tools**
---------

* `memory_store`: encrypts, hashes, vectorizes, and persists a semantic memory into the local SQLite database.
* `memory_search`: performs optimized vector similarity cosine searches on stored memories.
* `memory_delete`: deletes a specific semantic memory record by its identifier.
* `memory_consolidate`: performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
* `memory_relate`: establishes a graph relationship between two memory nodes.
* `memory_export`: exports active database memories into Markdown notes for Obsidian integration.

**Architectural Purpose**
-------------------------

The MCP bridge is designed to provide a high-performance interface for interacting with the cognitive memory application's underlying database, while ensuring secure and efficient data transfer. The tools defined in this file enable various operations on semantic memories, such as storage, search, deletion, consolidation, relation establishment, and export.