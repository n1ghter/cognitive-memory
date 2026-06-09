```markdown
# In-process database management module

This module provides a singleton manager for an in-process SQLite database, 
exposing functionality to interact with the database and its tables.

### Exposed MCP Tools

* `sqlite-vec` extension is loaded for efficient data storage.
* WAL mode is enabled for improved concurrency.

### Architectural Purpose

The primary purpose of this module is to provide a centralized interface 
for managing the in-process database, enabling efficient and secure data access.