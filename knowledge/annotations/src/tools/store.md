**Store Store Logic**
=====================

This file contains the implementation of a memory store function that interacts with SQLite tables using `DatabaseManager` and exposes MCP (Metadata Commons Profile) tools.

The function takes in text metadata, optional metadata, and importance level as arguments. It executes a transaction to ensure atomicity between storing text metadata and vector table records.

**Explicitly Exposed Tools/Tables**
-----------------------------------

* `DatabaseManager`
* `SQLite tables: memory` and `vec_memory`

**Business Logic Purpose**
---------------------------

The purpose of this file is to provide a centralized store function for metadata, ensuring data consistency across the application.