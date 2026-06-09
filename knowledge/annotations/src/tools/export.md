**Export Tools Annotation**
================================

### Purpose

This file provides the `executeMemoryExport` function, which exports Obsidian-compatible Markdown files containing memories from a SQLite database. The function interacts with the `DatabaseManager` to fetch and process memory data.

### Tools Used

*   `fs`: File system module for creating directories and writing files
*   `path`: Path manipulation module for resolving directory paths
*   `DatabaseManager`: A custom database management system used to interact with the SQLite database