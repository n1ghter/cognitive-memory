**Integration Test for Memory Store and Search**
=====================================================

This test suite verifies the integration of memory store and search functionality using SQLite vectors. It ensures that text data is successfully stored, searched, and retrieved.

*   **Interactions with:**
    *   `DatabaseManager` (database management)
    *   `executeMemoryStore` (memory store tool)
    *   `executeMemorySearch` (memory search tool)
*   **Purpose:** Validate the correctness of memory-based data storage and retrieval.
*   **Scenario:** Storing a text record with metadata and searching for similar records using an SQLite vector.