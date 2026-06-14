### MCP Server Bootstrap Tool - High Performance Bridge

#### Business Logic and Architectural Purpose

The `src/index.ts` file serves as the entry point for the high-performance bridge of the Model-Context Protocol (MCP). It is responsible for setting up the server application, connecting to a SQLite database, and exposing various tools for memory management.

The primary purpose of this tool is to provide a robust and efficient interface for interacting with MCP databases. It utilizes a combination of `DatabaseManager`, `StdioServerTransport`, and custom tool functions (`memory_store`, `memory_sync`, etc.) to manage semantic memories.

Key Features:

*   Initializes the MCP server application
*   Connects to a SQLite database using `DatabaseManager`
*   Exposes various tools for memory management, including:
    *   `memory_store`: Encrypts, hashes, vectorizes, and persists semantic memories into a local SQLite database.
    *   `memory_sync`: Performs bidirectional synchronization between Obsidian Markdown files and the SQLite database.
    *   `memory_relate`: Establishes graph relationships between two memory nodes.
    *   `memory_search`: Performs optimized vector similarity cosine searches on stored memories.
    *   `memory_export`: Exports active database memories into Markdown notes for Obsidian integration.
    *   `memory_consolidate`: Performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
    *   `memory_delete`: Deletes a specific semantic memory record by its identifier.

#### Tools Exposed

This tool exposes the following MCP tools:

*   `memory_store`
*   `memory_sync`
*   `memory_relate`
*   `memory_search`
*   `memory_export`
*   `memory_consolidate`
*   `memory_delete`

These tools provide a comprehensive set of functions for managing semantic memories, ensuring efficient and secure data storage and retrieval.