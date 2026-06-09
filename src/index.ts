import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DatabaseManager } from './db.js';
import { executeMemoryStore } from './tools/store.js';
import { executeMemorySearch } from './tools/search.js';
import { executeMemoryDelete } from './tools/delete.js';
import { executeMemoryConsolidate } from './tools/consolidate.js';
import { executeMemoryRelate } from './tools/graph.js';
import { executeMemoryExport } from './tools/export.js';
import { executeMemoryClearAll } from './tools/clear.js';

/**
 * Critical Performance Enhancement: Stdio Safeguard
 * 
 * Redirects all stdout logging to stderr, forcing safe transport of JSON-RPC message packets.
 */
const originalLog = console.log;
console.log = console.error;

/**
 * Create a new McpServer instance with a specific name and version.
 */
const server = new McpServer({
  /**
   * Name of the server application
   */
  name: 'cognitive-memory',
  /**
   * Version of the server application
   */
  version: '1.0.0',
});

/**
 * Define a tool that encrypts, hashes, vectorizes, and persists semantic memories into a local SQLite database.
 */
server.tool(
  /**
   * Tool ID
   */
  'memory_store',
  /**
   * Tool description
   */
  'Encrypt/Hash, vectorize, and persist a semantic memory into a local SQLite database',
  {
    /**
     * Input parameter for the core text content of the memory to store.
     */
    text: z.string().describe('The core text content of the memory to store'),
    /**
     * Optional input parameter for auxiliary metadata object association.
     */
    metadata: z.record(z.any()).optional().describe('Optional auxiliary metadata object to associate with the memory'),
    /**
     * Optional input parameter for importance score (0.0 to 1.0).
     */
    importance: z.number().min(0.0).max(1.0).optional().default(0.5).describe('The importance score of the memory (0.0 to 1.0)'),
  },
  /**
   * Asynchronous function that executes the tool's logic.
   */
  async ({ text, metadata, importance }) => {
    try {
      const result = await executeMemoryStore({ text, metadata, importance });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      console.error('[MCP Error] memory_store failed:', error);
      return {
        isError: true,
        content: [{ type: 'text', text: error.message || String(error) }],
      };
    }
  }
);

/**
 * Define a tool that performs optimized vector similarity cosine searches on stored memories.
 */
server.tool(
  /**
   * Tool ID
   */
  'memory_search',
  /**
   * Tool description
   */
  'Perform optimized vector similarity cosine searches on stored memories',
  {
    /**
     * Input parameter for the semantic search query.
     */
    query: z.string().describe('Semantic search query'),
    /**
     * Optional input parameter for maximum closely related memories to retrieve (1-100).
     */
    limit: z.number().int().min(1).max(100).optional().default(5).describe('Max number of closely related memories to retrieve'),
    /**
     * Optional input parameter for minimum cosine similarity match threshold (0.0-1.0).
     */
    threshold: z.number().min(0.0).max(1.0).optional().default(0.6).describe('Minimum cosine similarity match threshold (0.0 to 1.0)'),
  },
  /**
   * Asynchronous function that executes the tool's logic.
   */
  async ({ query, limit, threshold }) => {
    try {
      const result = await executeMemorySearch({ query, limit, threshold });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      console.error('[MCP Error] memory_search failed:', error);
      return {
        isError: true,
        content: [{ type: 'text', text: error.message || String(error) }],
      };
    }
  }
);

/**
 * Define a tool that deletes a specific semantic memory record by its identifier.
 */
server.tool(
  /**
   * Tool ID
   */
  'memory_delete',
  /**
   * Tool description
   */
  'Delete a specific semantic memory record by its identifier',
  {
    /**
     * Input parameter for the record identifier to erase (e.g. "memory:uuid" or "uuid").
     */
    id: z.string().describe("Record identifier to erase (e.g. 'memory:uuid' or 'uuid')"),
    /**
     * Optional input parameter for physical purging of records (true/false).
     */
    hard: z.boolean().optional().default(false).describe('If true, physically purges the record. Otherwise performs a soft-delete (default)'),
  },
  /**
   * Asynchronous function that executes the tool's logic.
   */
  async ({ id, hard }) => {
    try {
      const result = await executeMemoryDelete({ id, hard });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      console.error('[MCP Error] memory_delete failed:', error);
      return {
        isError: true,
        content: [{ type: 'text', text: error.message || String(error) }],
      };
    }
  }
);

/**
 * Define a tool that completely wipes all memories from the database. (Nuclear Option)
 */
server.tool(
  'memory_clear_all',
  'NUCLEAR OPTION: Completely wipe all memories, vectors, and graph edges from the database. Cannot be undone.',
  {
    confirm: z.boolean().describe('Must be set to true to confirm the complete deletion of all data'),
  },
  async ({ confirm }) => {
    try {
      const result = await executeMemoryClearAll({ confirm });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      console.error('[MCP Error] memory_clear_all failed:', error);
      return {
        isError: true,
        content: [{ type: 'text', text: error.message || String(error) }],
      };
    }
  }
);

/**
 * Define a tool that performs time decay and semantic LLM merging/deduplication on active memories using Ollama.
 */
server.tool(
  /**
   * Tool ID
   */
  'memory_consolidate',
  /**
   * Tool description
   */
  'Perform time decay and semantic LLM merging/deduplication on active memories using Ollama',
  {},
  /**
   * Asynchronous function that executes the tool's logic.
   */
  async () => {
    try {
      const result = await executeMemoryConsolidate();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      console.error('[MCP Error] memory_consolidate failed:', error);
      return {
        isError: true,
        content: [{ type: 'text', text: error.message || String(error) }],
      };
    }
  }
);

/**
 * Define a tool that establishes a graph relationship between two memory nodes.
 */
server.tool(
  /**
   * Tool ID
   */
  'memory_relate',
  /**
   * Tool description
   */
  'Establish a graph relationship between two memory nodes',
  {
    /**
     * Input parameter for the source memory node ID (e.g. "memory:uuid").
     */
    sourceId: z.string().describe('ID of the source memory node (e.g. memory:uuid)'),
    /**
     * Input parameter for the target memory node ID (e.g. "memory:uuid").
     */
    targetId: z.string().describe('ID of the target memory node (e.g. memory:uuid)'),
    /**
     * Input parameter for the type of relation (e.g. dependency, contradicts, consolidated_from).
     */
    relationType: z.string().describe('Type of relation (e.g. dependency, contradicts, consolidated_from)'),
  },
  /**
   * Asynchronous function that executes the tool's logic.
   */
  async ({ sourceId, targetId, relationType }) => {
    try {
      const result = await executeMemoryRelate({ sourceId, targetId, relationType });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      console.error('[MCP Error] memory_relate failed:', error);
      return {
        isError: true,
        content: [{ type: 'text', text: error.message || String(error) }],
      };
    }
  }
);

/**
 * Define a tool that exports active database memories into Markdown notes for Obsidian integration.
 */
server.tool(
  /**
   * Tool ID
   */
  'memory_export',
  /**
   * Tool description
   */
  'Export active database memories into Markdown notes for Obsidian integration',
  {
    /**
     * Optional input parameter for custom path to the Obsidian vault directory.
     */
    vaultPath: z.string().optional().describe('Optional custom path to the Obsidian vault directory'),
  },
  /**
   * Asynchronous function that executes the tool's logic.
   */
  async ({ vaultPath }) => {
    try {
      const result = await executeMemoryExport({ vaultPath });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      console.error('[MCP Error] memory_export failed:', error);
      return {
        isError: true,
        content: [{ type: 'text', text: error.message || String(error) }],
      };
    }
  }
);

/**
 * Bootstrap function that sets up the server application.
 */
async function bootstrap() {
  try {
    console.error('[MCP Server] Bootstrapping high-performance bridge...');

    await DatabaseManager.getInstance();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP Server] Bridge successfully initialized and listening on stdio.');
  } catch (error) {
    console.error('[MCP Server] Critical initialization failure:', error);
    process.exit(1);
  }
}

// Global exception shielding
process.on('uncaughtException', (err: any) => {
  console.error('[Critical Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  console.error('[Unhandled Promise Rejection]:', reason, 'at:', promise);
});

bootstrap();