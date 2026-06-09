### Why

This file implements the `executeMemoryExport` function, which is responsible for exporting memories from a database into Obsidian-compatible Markdown files. The purpose of this function is to convert the structured data in the database into a format that can be easily imported into an Obsidian vault.

The export process involves:

*   Fetching all memories and edges from the database
*   Building edge lookup maps to generate links between memories
*   Generating a Markdown file for each memory with frontmatter and content
*   Writing the files to disk and updating their timestamps

This function is used to create an Obsidian vault by exporting the structured data in the database into a format that can be easily imported.

### Exposed Tools/Functions

The `executeMemoryExport` function interacts with SQLite tables using the `DatabaseManager` class.