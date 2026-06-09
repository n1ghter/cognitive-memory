```markdown
**Semantic Summary**

This test file verifies the functionality of the `executeMemoryClearAll` tool, ensuring that data is successfully cleared from the database when the confirmation option is set to `true`. It also tests that an error occurs when attempting to clear data without confirmation. Specifically, this test interacts with:
 
* MCP tools: `executeMemoryStore`, `executeMemoryRelate`
* SQLite tables: `memory`, `vec_memory`, `edges`, `embedding_cache`

The purpose of this file is to validate the business logic surrounding memory clearance in our application.
```