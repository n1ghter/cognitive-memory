### Semantic Summary for `tests/sync.test.ts`

#### Purpose and Business Logic

This test suite verifies the bidirectional synchronization of memories between Obsidian vaults using SQLite databases. The test creates a temporary directory, stores a memory in the DB, creates a corresponding memory in an Obsidian vault, and then synchronizes both to verify their mutual presence.

#### Exposed Tools and Interactions

* `executeMemorySync` (MCP tool)
* `DatabaseManager.close`
* `fs.rmSync` (SQLite table interaction)