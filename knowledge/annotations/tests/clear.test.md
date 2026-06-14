**Test Clear All**
===============

*Exposes MCP tools: SQLite*
Clears data from the database when confirmed.

This test suite verifies the functionality of `executeMemoryClearAll` tool, ensuring it successfully clears all data when confirmation is provided and fails if not. The test also covers error handling, including rollback transactions during the data wipe process.