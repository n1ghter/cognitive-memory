**Export Tools Annotation**
==========================

This file exports Obsidian-compatible Markdown files from the database, generating a Graph View for each memory. It fetches all active memories and edges from the database, builds edge lookup maps, and generates a separate Markdown file for each memory.

Exposed MCP Tools:

*   `DatabaseManager`

Exposed Interactions with SQLite Tables:

*   `memory` table
*   `edges` table