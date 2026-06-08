### Semantic Summary for src/db.ts
#### Business Logic and Architectural Purpose

This file provides a `DatabaseManager` class that serves as a singleton instance of an in-process SQLite database. The manager loads the database at startup, initializes the schema with necessary tables and indexes, and exposes methods to interact with the database.

It also generates random UUIDs using the `crypto.randomUUID()` function and normalizes record IDs by splitting them into parts and removing the first part if present. 

The file does not directly expose MCP tools or interfaces with SQLite tables; however, it is designed to be used as a centralized database manager for the application.

#### Key Features

*   Singleton instance management
*   Database schema initialization
*   Random UUID generation
*   Normalized record ID processing