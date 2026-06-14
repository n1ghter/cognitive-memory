```markdown
# MCP Server Initialization and Setup

The MCP server is initialized with a specific name and version. It includes tools for managing semantic memories, such as encryption, hashing, vectorization, and persistence to a local SQLite database.

## Key Features:

- Encrypts, hashes, vectorizes, and persists semantic memories into a local SQLite database (memory_store)
- Performs optimized vector similarity cosine searches on stored memories (memory_search)
- Deletes specific semantic memory records by their identifier (memory_delete)
- Completely wipes all memories from the database (memory_clear_all)
- Establishes graph relationships between two memory nodes (memory_relate)
- Exports active database memories into Markdown notes for Obsidian integration (memory_export)
- Performs bidirectional synchronization between local Obsidian Markdown files and the SQLite database (memory_sync)

## Tools Interacting with SQLite Tables:

* `memory_store`: interacts with the `sqlite` table
* `memory_search`, `memory_delete`, `memory_relate`, `memory_clear_all`, `memory_export`, `memory_sync`: all interact with their respective tables

## Tools Exposed by MCP Server:

* `memory_store`
* `memory_search`
* `memory_delete`
* `memory_relate`
* `memory_clear_all`
* `memory_export`
* `memory_sync`

## Bootstrap Function:

The bootstrap function initializes the server application and sets up the database manager.

### MCP Server Bootstrapping

```typescript
async function bootstrap() {
  try {
    // Initialize DatabaseManager instance
    await DatabaseManager.getInstance();
    
    // Set up StdioServerTransport for connection
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP Server] Bridge successfully initialized and listening on stdio.');
  } catch (error) {
    console.error('[MCP Server] Critical initialization failure:', error);
    process.exit(1);
  }
}
```

### Global Exception Handling

```typescript
process.on('uncaughtException', (err: any) => {
  console.error('[Critical Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  console.error('[Unhandled Promise Rejection]:', reason, 'at:', promise);
});
```

### CLI Initialization and Setup

```typescript
if (process.argv[2] === 'init') {
  import('./cli/init.js').then(m => m.runInit()).catch(err => {
    console.error('Initialization failed:', err);
    process.exit(1);
  });
} else if (process.argv[2] === 'setup') {
  import('./cli/setup.js').then(m => m.runSetup()).catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
} else {
  bootstrap();
}
```

```