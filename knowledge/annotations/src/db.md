### Database Manager Purpose
The `DatabaseManager` class is responsible for managing the in-process database, including creating a new instance upon request, initializing the schema with necessary tables and indexes, and providing methods to normalize record IDs and generate random UUIDs.

* Interacts with:
	+ SQLite tables (`memory`, `edges`, `sync_ledger`, `embedding_cache`)
	+ sqlite-vec extension
* Exposes MCP tools: None