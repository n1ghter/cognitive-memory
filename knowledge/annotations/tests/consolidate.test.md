**Consolidation Tools Test Suite**
=====================================

This test suite verifies the functionality of memory consolidation tools, ensuring that memories are properly consolidated, pruned, and handled during errors.

### Exposed MCP Tools:

*   `DatabaseManager`
*   `executeMemoryStore` (SQLite table interaction)
*   `executeMemoryConsolidate` (SQLite table interaction)

### Test Purpose:

This suite tests the business logic of memory consolidation tools to ensure that memories are consolidated correctly, pruned when necessary, and errors are handled gracefully.