### Tests for Memory Store and Search Integration

#### MCP Interactions:

* SQLite tables: `executeMemoryStore`, `executeMemorySearch`
* Ollama tools: `OllamaClient` (mocked in this file)

This test suite ensures the integration of memory store and search functionality, verifying that stored records can be successfully retrieved and matched against queries. It uses a mock Ollama client to isolate dependencies from the real database container.

```markdown
# Why (Business Logic, Architectural Purpose)
## Purpose

Verify the successful storage and retrieval of records using the memory store.
Ensure correct query matching with the search tool.

## Key Functionalities

- Store records in memory-based database
- Search for records based on queries
```