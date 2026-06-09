### Tests Bootstrap Semantic Summary
#### MCP Tools/SQLite Interaction:

- MCP tools: `../src/tools/consolidate.js`, `../src/tools/export.js`
- SQLite interaction through `../src/db.js`

### Business Logic/Purpose:
The purpose of this file is to test the `bootstrap.ts` hook module, ensuring it runs correctly under various scenarios, including different event types (SessionStart, PreCompact, Stop) and error conditions. The test verifies that hooks are executed as expected and that the database and process exit functions are called accordingly.