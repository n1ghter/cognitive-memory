```markdown
# Web Server API Tests

This file contains tests for the web server's API functionality. It ensures the server returns valid JSON responses and serves static files correctly.

## Exposure of MCP Tools/SQLite Tables:

- `supertest`
- SQLite tables: `main.memory`, `global.memory`, and `edges`

## Architectural Purpose:

The purpose of this test suite is to validate the web server's API behavior, specifically its response to requests for graph data and serving static files from the UI dist directory.
```