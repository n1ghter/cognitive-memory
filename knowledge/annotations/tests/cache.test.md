```markdown
**Semantic Summary**

This test file validates the behavior of `EmbeddingCache` in various scenarios, including:

* Computing valid SHA-256 hashes for different input texts
* Handling errors when computing embeddings (e.g., empty text, SQLite read/write failures)
* Caching embeddings in L1 and L2 storage layers

Specifically, it tests that:
* Valid hashes are computed correctly regardless of case and whitespace trimming
* An error is thrown when attempting to compute an embedding for empty text
* Embeddings are cached in both L1 and L2 layers and retrieved accordingly
* The cache handles errors during read and write operations to SQLite

**Exposed Tools/Interactions**

* MCP tools: `DatabaseManager` (close, getInstance), SQLite (prepare)
```