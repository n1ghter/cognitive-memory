```markdown
**Semantic Summary**

This test suite verifies the functionality of the `EmbeddingCache` class, ensuring that it:
- Computes a valid SHA-256 hash for input strings, ignoring case and trimming whitespace.
- Produces consistent results across different input cases.
- Returns a hash with the expected length (64 characters) for the SHA-256 algorithm.

No MCP tools or direct SQLite interactions are exposed in this test file. The purpose of this test suite is to validate the business logic of the `EmbeddingCache` class, which is responsible for hashing and comparing strings. 
```