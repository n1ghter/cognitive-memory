**Semantic Summary**
===============

This file implements the memory import functionality, responsible for importing and upserting memory nodes and edges into the database. The main purpose is to import data from markdown files stored in a directory, parse and validate the data, and update the database accordingly.

### Exposed MCP Tools:

*   `DatabaseManager`

### Interactions with SQLite Tables:

*   `memory`
*   `edges`
*   `vec_memory`