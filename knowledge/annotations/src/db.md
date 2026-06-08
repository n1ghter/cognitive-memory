## Database Management System
### MCP Tools and Interactions

* Exposes `Database` instance through the `getInstance()` method, which interacts with SQLite tables.

### Business Logic

This file implements a singleton-based database management system that provides basic CRUD operations. It includes functionality for generating random UUIDs, normalizing record IDs, and initializing the database schema.

The database schema consists of several tables: `memory`, `edges`, `sync_ledger`, and `embedding_cache`. The `edges` table establishes relationships between records in the `memory` table, while the `sync_ledger` table manages file sync operations.