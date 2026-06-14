```markdown
# In-process Database Manager

This module provides a singleton class `DatabaseManager` responsible for managing an in-process SQLite database.
It initializes the schema, loads sqlite-vec extension, enables WAL mode, and attaches the global database.
The purpose of this manager is to enable fast data access and concurrency.

Exposed MCP Tools:

* Uses sqlite-vec extension
```

Note: This annotation focuses solely on the business logic and architectural purposes of the code, excluding standard interfaces or parameter types.