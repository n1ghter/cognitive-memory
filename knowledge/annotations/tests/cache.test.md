```markdown
This file tests the functionality of the `EmbeddingCache` class, specifically its ability to compute valid SHA-256 hashes and handle caching and database interactions. The tests cover various scenarios, including:

* Computing valid SHA-256 hashes for different input texts
* Handling empty text inputs with an error message
* Caching embeddings in both L1 and L2 cache layers
* Handling read and write errors in the L2 SQLite cache layer

The tests interact with the Ollama database layer and mock its responses to ensure isolation of the caching logic.
```