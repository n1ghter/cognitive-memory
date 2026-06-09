### Semantic Summary
#### Why

This file exports memories from a database into Obsidian-compatible Markdown files, generating a Graph View. The purpose is to facilitate the management and organization of memories in an Obsidian vault.

It interacts with the `DatabaseManager` instance to fetch memories and edges, then generates Markdown files for each memory with relevant metadata, edge relations, and frontmatter.

The file exposes the following tools or interactions:

* `DatabaseManager`
* `fs` (file system)

#### Architectural Purpose

The purpose of this file is to provide a tool for exporting memories from a database into Obsidian-compatible format, enabling users to manage their memories in an organized manner.