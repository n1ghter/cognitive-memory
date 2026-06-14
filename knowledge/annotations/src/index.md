**Semantic Summary**
=====================

The `index.ts` file sets up a high-performance bridge for the Model Context Protocol (MCP). It creates an instance of the `McpServer` class, which serves as the entry point for MCP tools. The server is configured with various tools that perform different operations on data stored in a local SQLite database.

**Key Features**
----------------

*   **Tool Definition**: The file defines several tools, including:
    *   `memory_search`: Performs optimized vector similarity cosine searches on stored memories.
    *   `memory_store`: Encrypts, hashes, vectorizes, and persists semantic memories into the SQLite database.
    *   `memory_relate`: Establishes a graph relationship between two memory nodes.
    *   `memory_sync`: Performs bidirectional synchronization between Obsidian Markdown files and the SQLite database.
    *   `memory_export`: Exports active database memories into Markdown notes for Obsidian integration.
    *   `memory_consolidate`: Performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
    *   `memory_delete`: Deletes a specific semantic memory record by its identifier.
*   **Database Interaction**: The server interacts with the SQLite database through the `DatabaseManager` class, which provides a standardized interface for accessing and modifying data.
*   **Exception Handling**: The file sets up global exception shielding using `process.on('uncaughtException')` and `process.on('unhandledRejection')`.

**Notes**
-------

The `index.ts` file is the main entry point for the MCP server. It initializes the server, connects it to a transport (in this case, stdio), and sets up various tools that perform different operations on data stored in the SQLite database.