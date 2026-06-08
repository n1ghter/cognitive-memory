```markdown
# MCP Server Index File Annotation

This file bootstraps the high-performance bridge of the Model Context Protocol (MCP) server. It initializes the database manager and establishes a connection to the standard input/output transport.

**Purpose:** To serve as the entry point for the MCP server application, responsible for executing various memory-related tools and handling exceptions.

**Interactions:**

*   Exposes `executeMemoryStore`, `executeMemorySearch`, `executeMemoryDelete`, `executeMemoryConsolidate`, `executeMemoryRelate`, and `executeMemoryExport` functions.
*   Uses SQLite database management.
```