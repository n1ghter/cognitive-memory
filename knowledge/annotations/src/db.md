# Annotation: src/db.ts
**Purpose:** Handles the lifecycle, initialization, and connection of the SQLite databases for cognitive-memory. Implements the Federated Memory Architecture by attaching a Global Database to the Local Project Database.
**Key Dependencies:** Connects to `.cognitive-memory/global-memory.sqlite` and `memory.sqlite` using `better-sqlite3`. Loads the `sqlite-vec` extension for vector embeddings.
**SQLite Database Tables:** `memory`, `vec_memory`, `edges`, `sync_ledger`, `embedding_cache`. Both local (`main`) and global schemas are initialized.
**Context:** Centralizes database connections. It uses the Singleton pattern to provide a unified `DatabaseManager` instance. Any changes here directly impact how memory is stored and retrieved across all agents.