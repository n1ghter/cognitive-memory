**Semantic Summary**
======================

This test suite verifies the functionality of the `executeMemoryStore` and `executeMemorySearch` tools, which store and retrieve metadata from a SQLite database. The tests ensure that:

*   Stores are successfully inserted with correct metadata.
*   Searches return accurate results within a specified limit.
*   Invalid queries (empty or null) throw an error.
*   Empty text inputs trigger errors.
*   Malformed JSON metadata defaults to string representation.
*   Database access updates log errors.
*   Critical search failures result in proper error handling.

**Exposed MCP Tools:**

*   `DatabaseManager`
*   `executeMemoryStore`
*   `executeMemorySearch`

**Interaction with SQLite Tables:**

*   `memory` table (INSERT, SELECT)
*   `vec_memory` table (INSERT)