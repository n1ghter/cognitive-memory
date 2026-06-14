```markdown
**Semantic Summary**
=====================

This test file (`tests/import.test.ts`) contains integration tests for the memory import functionality. It ensures that the system correctly imports new markdown files into SQLite databases, updates existing memories with newer versions of the same file, and handles various edge cases such as malformed markdown files, critical failure during parsing, database errors, and file system errors.

**Architectural Purpose**
-----------------------

The primary purpose of this test file is to validate the business logic of the memory import functionality. It ensures that the system behaves correctly in different scenarios, including successful imports, updates, and failures. The tests also cover various error cases, such as database errors, critical failure during parsing, and file system errors.

**Exposed MCP Tools or Interactions with SQLite Tables**
---------------------------------------------------

This test file interacts with the `DatabaseManager` class to create, update, and retrieve data from the SQLite tables. It also uses the `executeMemoryImport` and `executeMemoryStore` functions to import and store memories, respectively.
```