```markdown
# Clears all memories, vectors, and graph edges from the database.

**Purpose:** This tool is used to wipe all memories, vectors, and graph edges from the database. It ensures referential integrity by clearing edges first and provides a way to reset the system in case of an error.

**Interactions:**

* Exposes MCP tools:
  * `DatabaseManager`
* Interacts with SQLite tables:
  * `edges` table
  * `vec_memory` table
  * `memory` table
  * `embedding_cache` table

**Business Logic:** This tool is used to implement the "Nuclear Option" in case of an error or when all memories need to be cleared.
```