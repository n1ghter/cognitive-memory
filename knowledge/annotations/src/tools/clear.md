### Semantic Summary

* The `executeMemoryClearAll` function is responsible for securely deleting all memory records, semantic vectors, and edges from the database to enforce data consistency.
* This operation requires explicit confirmation and is performed in a transactional context to ensure atomicity.
* It uses the SQLite database management system (MCP) through the `DatabaseManager` service.