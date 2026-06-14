**Semantic Summary: MCP Server Application**
=============================================

The MCP server application is a high-performance bridge that provides a suite of tools for managing semantic memories. The primary purpose of this application is to enable efficient storage, retrieval, and manipulation of complex memory data.

**Business Logic:**

*   **Memory Management:** The application defines various tools for managing semantic memories, including:
    *   `memory_search`: Optimized vector similarity cosine searches on stored memories.
    *   `memory_store`: Encrypts, hashes, vectorizes, and persists semantic memories into a local SQLite database.
    *   `memory_relate`: Establishes graph relationships between two memory nodes.
    *   `memory_sync`: Performs bidirectional synchronization between Obsidian Markdown files and the SQLite database.
    *   `memory_export`: Exports active database memories into Markdown notes for Obsidian integration.
    *   `memory_consolidate`: Performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
    *   `memory_delete`: Deletes a specific semantic memory record by its identifier.
*   **Database Integration:** The application utilizes SQLite as the underlying database management system, ensuring seamless data storage and retrieval.

**Architectural Purpose:**

The MCP server application serves as a critical performance enhancement tool for safe transport of JSON-RPC message packets. It redirects all stdout logging to stderr, forcing safe transport of messages. This ensures the reliability and security of the overall system.

**MCP Tools/Interactions with SQLite Tables:**

*   `memory_search`
*   `memory_store`
*   `memory_relate`
*   `memory_sync`
*   `memory_export`
*   `memory_consolidate`
*   `memory_delete`