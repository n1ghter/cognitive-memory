## Semantic Summary
### Export Tests

This test suite validates the functionality of the memory export tool. It ensures that memories are correctly exported to markdown files and that relevant metadata, such as graph relations and categories, is included in the exports.

**Tools Exposed or Interacting with:**

* SQLite (via `DatabaseManager`)

**Architectural Purpose:**

This test suite verifies the business logic of the memory export tool, ensuring that it correctly handles creation of export directories, inclusion of graph relations, and formatting of metadata.