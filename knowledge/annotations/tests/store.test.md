**Tests for Memory Store and Search Integration**
=====================================================

This file contains integration tests for the `MemoryStore` and `MemorySearch` tools, ensuring they interact correctly with SQLite tables and mock Ollama functionality.

It covers scenarios where:

*   A document is stored using `executeMemoryStore`, including metadata.
*   Documents are searched using `executeMemorySearch` with a query.

**Tools Interacted:** 
-   executeMemoryStore
-   executeMemorySearch
-   SQLite