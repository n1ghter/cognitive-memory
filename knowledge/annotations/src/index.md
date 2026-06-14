### Semantic Summary: MCP Server Bootstrap

The `src/index.ts` file serves as the entry point for the Model Context Protocol (MCP) server application. Its primary purpose is to set up and initialize the server, which enables various tools for managing semantic memories.

**Purpose:**

* Initialize the MCP server with a specific name and version.
* Define and register multiple tool instances for various memory management tasks.

**Interactions:**

* Exposes `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`.
* Interacts with SQLite tables through the `DatabaseManager`.

### Business Logic:

The file orchestrates the bootstrapping process of the MCP server, including:

1. Setting up database connections.
2. Creating a transport instance for communication (Stdio Server Transport).
3. Establishing the server connection to the transport.
4. Registering tool instances for managing semantic memories.

By defining these tools and their corresponding logic, the file enables users to perform various memory-related operations, such as storing, relating, deleting, and consolidating memories.