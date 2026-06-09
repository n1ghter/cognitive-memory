```markdown
# McpServer Bootstrapping and Initialization

The `src/index.ts` file initializes the `McpServer` application with various tools and a database manager. This setup enables a high-performance bridge for cognitive memory management.

## Tools and Functions

*   The server includes several tools, each responsible for a specific task:
    *   `memory_store`: encrypts, hashes, vectorizes, and persists semantic memories into a local SQLite database.
    *   `memory_search`: performs optimized vector similarity cosine searches on stored memories.
    *   `memory_delete`: deletes a specific semantic memory record by its identifier.
    *   `memory_clear_all`: completely wipes all memories from the database (Nuclear Option).
    *   `memory_consolidate`: performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
    *   `memory_relate`: establishes a graph relationship between two memory nodes.
    *   `memory_export`: exports active database memories into Markdown notes for Obsidian integration.
    *   `memory_sync`: performs a bidirectional synchronization between local Obsidian Markdown files and the SQLite database.

## Database Management

*   The server uses a `DatabaseManager` instance to manage connections to the SQLite database.
*   A new `StdioServerTransport` is used for establishing communication with clients.

## Exception Handling

*   Global exception shielding is implemented using `process.on('uncaughtException')` and `process.on('unhandledRejection')`.
```