**Clear Memory Functionality**

* The `clearMemoryClearAll` function is responsible for securely wiping all memories, semantic vectors, and graph edges from the database to reset a nuclear option. It ensures referential integrity by clearing edges first.

Exposes:
* MCP tool: Database execution and transaction management
* SQLite interaction: Deletes data from various tables (edges, vec_memory, memory, embedding_cache)