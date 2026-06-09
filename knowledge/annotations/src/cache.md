```markdown
# Embedding Cache

The `EmbeddingCache` class provides a fast in-memory L1 cache and a fallback mechanism using an SQLite table (MCP) for storing computed embeddings.
## Why

The primary purpose of this class is to enable high-speed lookups for embedded vectors, allowing for efficient computation and caching of embeddings.

## Interaction with MCP Tools and SQLite Tables

- Exposes `computeHash` method
- Interacts with SQLite tables via `DatabaseManager`
```