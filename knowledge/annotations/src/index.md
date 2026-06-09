### Semantic Summary
#### MCP Server Application

The MCP server application provides a set of tools for managing semantic memories. The application uses the `McpServer` class to create an instance and defines several tools that interact with a local SQLite database.

- **memory_store**: Encrypts, hashes, vectorizes, and persists semantic memories into the database.
- **memory_search**: Performs optimized vector similarity cosine searches on stored memories.
- **memory_delete**: Deletes a specific semantic memory record by its identifier.
- **memory_clear_all**: Completely wipes all memories from the database (nuclear option).
- **memory_consolidate**: Performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
- **memory_relate**: Establishes a graph relationship between two memory nodes.
- **memory_export**: Exports active database memories into Markdown notes for Obsidian integration.

The tools are defined as part of the `McpServer` instance and utilize asynchronous functions to execute their logic. The application uses an `StdioServerTransport` for standard input/output and has global exception shielding mechanisms to catch uncaught exceptions and unhandled promise rejections.

#### MCP Tools
- MCP Tools: `memory_store`, `memory_search`, `memory_delete`, `memory_clear_all`, `memory_consolidate`, `memory_relate`, `memory_export`

#### Database Interaction
The application interacts with the SQLite database through the `DatabaseManager` class and its tools.