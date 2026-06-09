```markdown
# Memory Import Test Suite

This test suite exercises the functionality of the memory import tool, which imports markdown files into a SQLite database.

## Exposed MCP Tools/SQLite Tables

- `DatabaseManager`
- `executeMemoryImport` (exposes MCP tools for importing markdown files)
- `executeMemoryStore` (exposes MCP tools for storing individual memories)
- `sqlite` tables: `memory`, `edges`

The test suite covers various scenarios, including:

* Importing new markdown files into SQLite
* Updating existing memory entries based on file modifications
* Skipping import if file is not newer than the stored version
* Handling malformed markdown files with best-effort parsing

These tests ensure that the memory import tool functions as expected and handles different edge cases.