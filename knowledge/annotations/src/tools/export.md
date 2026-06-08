```markdown
# Memory Export Tool

## Business Logic

This file implements the memory export tool that exports memories from a database and saves them in markdown files.

## Architectural Purpose

The main purpose of this tool is to synchronize memories across different types and formats, ensuring consistency and accuracy. It also provides a way to generate human-readable content for each memory block.

## MCP Tools/SQLite Interactions

- This file interacts with the SQLite database using the `DatabaseManager` instance.
- It exposes the `memory_export` function that can be called programmatically or as part of a workflow.
```