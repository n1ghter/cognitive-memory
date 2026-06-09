**Sync Tool**
===============

The `sync.ts` file is responsible for synchronizing data between Obsidian and SQLite databases. It leverages the `executeMemoryImport` and `executeMemoryExport` tools to pull changes from Obsidian into SQLite, followed by pushing changes from SQLite out to Obsidian.

*   Exposes MCP (Markdown Clone Protocol) tools: `executeMemoryImport`, `executeMemoryExport`
*   Interacts with SQLite tables through these MCP tools
*   Provides a business logic layer for synchronizing data between the two databases

**Semantic Summary**
--------------------

This file implements the main synchronization logic, ensuring that changes are propagated between Obsidian and SQLite.