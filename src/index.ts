#!/usr/bin/env node
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { DatabaseManager } from './db.js';
import { executeMemoryClearAll } from './tools/clear.js';
import { executeMemoryConsolidate } from './tools/consolidate.js';
import { executeMemoryDelete } from './tools/delete.js';
import { executeMemoryExport } from './tools/export.js';
import { executeMemoryRelate } from './tools/graph.js';
import { executeMemorySearch } from './tools/search.js';
import { executeMemoryStore } from './tools/store.js';
import { executeMemorySync } from './tools/sync.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

/**
 * Critical Performance Enhancement: Stdio Safeguard
 *
 * Redirects all stdout logging to stderr, forcing safe transport of JSON-RPC message packets.
 */
const _originalLog = console.log;
console.log = console.error;

const LOCALHOST_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * Returns true if the given bind host is a loopback address.
 */
export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

/**
 * Resolves and validates SSE network binding settings.
 * Refuses to bind non-loopback interfaces without MCP_AUTH_TOKEN unless explicitly opted in.
 */
export function resolveSseBindConfig(env: NodeJS.ProcessEnv = process.env): {
  host: string;
  port: number;
  authToken?: string;
  corsOrigin?: string;
} {
  const host = env.MCP_HOST || '127.0.0.1';
  const port = Number(env.PORT || env.SSE_PORT || 3000);
  const authToken = env.MCP_AUTH_TOKEN?.trim() || undefined;
  const corsOrigin = env.MCP_CORS_ORIGIN?.trim() || undefined;

  if (!isLoopbackHost(host) && !authToken && env.MCP_ALLOW_INSECURE_REMOTE !== 'true') {
    throw new Error(
      `Refusing to bind unauthenticated MCP SSE server to non-loopback host "${host}". ` +
        'Set MCP_AUTH_TOKEN for remote access, or bind to 127.0.0.1.'
    );
  }

  return { host, port, authToken, corsOrigin };
}

function timingSafeBearerMatch(headerValue: string | undefined, expectedToken: string): boolean {
  if (!headerValue?.startsWith('Bearer ')) {
    return false;
  }
  const provided = Buffer.from(headerValue.slice('Bearer '.length));
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(provided, expected);
}

/**
 * Factory function to create and configure a new McpServer instance.
 * Each connection (especially HTTP/SSE) requires a distinct McpServer instance.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'cognitive-memory',
    version,
  });

  server.tool(
    'memory_search',
    'Perform hybrid memory search (SQLite FTS5 BM25 + optional dense vector RRF) with zero-Ollama fallback, scope, and profile filtering',
    {
      query: z.string().describe('Search query (keywords, identifiers, or natural language)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(5)
        .describe('Max number of closely related memories to retrieve'),
      threshold: z
        .number()
        .min(0.0)
        .max(1.0)
        .optional()
        .default(0.6)
        .describe('Minimum similarity/confidence threshold (0.0 to 1.0)'),
      scope: z
        .enum(['local', 'global', 'all'])
        .optional()
        .default('local')
        .describe('Which memories to search: local project, global user-wide, or all'),
      profile: z
        .enum(['user', 'working', 'agent_core', 'all'])
        .optional()
        .default('all')
        .describe('Memory profile filter: user, working, agent_core, or all (default)'),
      mode: z
        .enum(['hybrid', 'bm25', 'vector'])
        .optional()
        .default('hybrid')
        .describe(
          'Retrieval mode: hybrid (FTS5 BM25 + optional dense RRF, default), bm25 (lexical only, zero Ollama), or vector (dense only)'
        ),
    },
    async ({ query, limit, threshold, scope, profile, mode }) => {
      try {
        const result = await executeMemorySearch({ query, limit, threshold, scope, profile, mode });
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

  server.tool(
    'memory_store',
    'Vectorize and persist a semantic memory into a local or global SQLite database',
    {
      text: z.string().describe('The core text content of the memory to store'),
      metadata: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          'Optional auxiliary metadata object (supports ref: { vault_path, wikilink, source_hash, section })'
        ),
      importance: z
        .number()
        .min(0.0)
        .max(1.0)
        .optional()
        .default(0.5)
        .describe('The importance score of the memory (0.0 to 1.0)'),
      scope: z
        .enum(['local', 'global'])
        .optional()
        .default('local')
        .describe('Where to store the memory: local project or global user-wide'),
      profile: z
        .enum(['user', 'working', 'agent_core'])
        .optional()
        .describe('Memory profile isolation: user (default), working, or agent_core'),
    },
    async ({ text, metadata, importance, scope, profile }) => {
      try {
        const result = await executeMemoryStore({ text, metadata, importance, scope, profile });
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

  server.tool(
    'memory_relate',
    'Establish a graph relationship between two memory nodes (or an external obsidian:///vault:// URI)',
    {
      sourceId: z.string().describe('ID of the source memory node (e.g. memory:uuid)'),
      targetId: z
        .string()
        .describe('ID of the target memory node or external obsidian:///vault:// URI'),
      relationType: z
        .string()
        .describe(
          'Type of relation (e.g. dependency, contradicts, consolidated_from, grounded_in, references)'
        ),
    },
    async ({ sourceId, targetId, relationType }) => {
      try {
        const result = await executeMemoryRelate({
          sourceId,
          targetId,
          relationType,
        });
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

  server.tool(
    'memory_sync',
    'Perform a bidirectional synchronization between local Obsidian Markdown files and the SQLite database',
    {
      vaultPath: z
        .string()
        .optional()
        .describe('Optional custom path to the Obsidian vault directory'),
    },
    async ({ vaultPath }) => {
      try {
        const result = await executeMemorySync({ vaultPath });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        console.error('[MCP Error] memory_sync failed:', error);
        return {
          isError: true,
          content: [{ type: 'text', text: error.message || String(error) }],
        };
      }
    }
  );

  server.tool(
    'memory_export',
    'Export active database memories into Markdown notes for Obsidian integration',
    {
      vaultPath: z
        .string()
        .optional()
        .describe('Optional custom path to the Obsidian vault directory'),
    },
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

  server.tool(
    'memory_consolidate',
    'Perform time decay and semantic LLM merging/deduplication on active memories using Ollama',
    {},
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

  server.tool(
    'memory_delete',
    'Delete a specific semantic memory record by its identifier',
    {
      id: z.string().describe("Record identifier to erase (e.g. 'memory:uuid' or 'uuid')"),
      hard: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'If true, physically purges the record. Otherwise performs a soft-delete (default)'
        ),
    },
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

  server.tool(
    'memory_clear_all',
    'NUCLEAR OPTION: Completely wipe all memories, vectors, and graph edges from the database. Cannot be undone.',
    {
      confirm: z
        .boolean()
        .describe('Must be set to true to confirm the complete deletion of all data'),
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

  return server;
}

/**
 * Builds the hardened Express app for SSE MCP transport.
 * Enforces localhost-only CORS by default, optional bearer auth, and relative message endpoint paths.
 */
export function createSseApp(options: { authToken?: string; corsOrigin?: string } = {}) {
  const { authToken, corsOrigin } = options;
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (corsOrigin && origin === corsOrigin) return callback(null, true);
        if (LOCALHOST_ORIGIN_RE.test(origin)) return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
    })
  );

  if (authToken) {
    app.use((req, res, next) => {
      if (!timingSafeBearerMatch(req.headers.authorization, authToken)) {
        res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token' });
        return;
      }
      next();
    });
  }

  const activeTransports = new Map<string, SSEServerTransport>();

  app.get('/sse', async (_req, res) => {
    console.error('[SSE] Incoming SSE connection');
    const transport = new SSEServerTransport('/message', res);
    const sessionId = transport.sessionId;
    const mcpServer = createMcpServer();
    activeTransports.set(sessionId, transport);
    transport.onclose = () => activeTransports.delete(sessionId);
    transport.onerror = (err) => console.error(`[SSE] Transport error for ${sessionId}:`, err);

    try {
      await mcpServer.connect(transport);
    } catch (error) {
      console.error(`[SSE] Error connecting MCP server for ${sessionId}:`, error);
      activeTransports.delete(sessionId);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  });

  app.post('/message', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send('Missing sessionId query parameter');
      return;
    }

    const transport = activeTransports.get(sessionId);
    if (!transport) {
      res.status(404).send('Session not found');
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  return app;
}

/**
 * Standard bootstrap function using Stdio transport (default for CLI / Claude Code / Cursor / Antigravity).
 */
async function bootstrapStdio() {
  try {
    console.error('[MCP Server] Bootstrapping high-performance bridge on stdio...');

    await DatabaseManager.getInstance();
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP Server] Bridge successfully initialized and listening on stdio.');
  } catch (error) {
    console.error('[MCP Server] Critical initialization failure:', error);
    process.exit(1);
  }
}

/**
 * Alternative bootstrap function for HTTP SSE transport (containerized / local multi-IDE daemon setups).
 */
async function bootstrapSSE() {
  try {
    const { host, port, authToken, corsOrigin } = resolveSseBindConfig(process.env);
    console.error(`[MCP Server] Bootstrapping SSE transport on ${host}:${port}...`);

    await DatabaseManager.getInstance();
    const app = createSseApp({ authToken, corsOrigin });

    app.listen(port, host, () => {
      console.error(`Cognitive Memory MCP Server (SSE) listening on http://${host}:${port}`);
    });
  } catch (error) {
    console.error('[MCP Server] Critical SSE initialization failure:', error);
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

if (process.argv[2] === 'init') {
  import('./cli/init.js')
    .then((m) => m.runInit())
    .catch((err) => {
      console.error('Initialization failed:', err);
      process.exit(1);
    });
} else if (process.argv[2] === 'setup') {
  import('./cli/setup.js')
    .then((m) => m.runSetup())
    .catch((err) => {
      console.error('Setup failed:', err);
      process.exit(1);
    });
} else if (
  process.argv[2] === 'serve' ||
  process.argv[2] === 'dashboard' ||
  process.argv[2] === 'ui'
) {
  import('./server/web.js')
    .then((m) => m.startWebServer())
    .catch((err) => {
      console.error('Web server failed:', err);
      process.exit(1);
    });
} else if (
  process.argv.includes('--sse') ||
  process.argv[2] === 'sse' ||
  process.env.TRANSPORT === 'sse' ||
  process.env.MCP_TRANSPORT === 'sse'
) {
  bootstrapSSE();
} else if (process.env.NODE_ENV !== 'test') {
  bootstrapStdio();
}
