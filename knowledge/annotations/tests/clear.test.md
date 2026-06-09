**Semantic Summary**
======================

This test suite validates the functionality of the `executeMemoryClearAll` tool, which clears all data from the database and related caches. The test ensures that:

* Data is successfully cleared when confirming deletion.
* A rejection occurs if confirmation is not provided.

Note: This test interacts with the `DatabaseManager` to update SQLite tables (`memory`, `vec_memory`, `edges`, and `embedding_cache`) and uses the `executeMemoryClearAll` tool, which exposes the MCP tools.