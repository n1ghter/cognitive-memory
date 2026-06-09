### Tests for Memory Consolidate Tool
#### Purpose:
This file tests the functionality of the Memory Consolidate tool, ensuring that it correctly consolidates memories with similar content and maintains active memory indicators.

#### Interactions:
- SQLite table: `memory`
- MCP tools (Mocked): `OllamaClient`

```markdown
This test suite validates the logic behind the Memory Consolidate tool. It tests scenarios where less than three memories are present, ensuring no issues arise from this case. It also checks active memory consolidation by storing and querying data in a database.
```