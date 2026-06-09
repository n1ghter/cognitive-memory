### Semantic Summary

#### Consolidation of Memories in Background

This test suite verifies the functionality of memory consolidation, ensuring that memories with low importance are pruned and deduplication occurs when there are enough active memories.

The `executeMemoryConsolidate` function interacts with SQLite tables: `memory`, `vec_memory`.

It also mocks the OllamaClient to simulate LLM errors during generation.