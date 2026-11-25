#!/usr/bin/env node
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DatabaseManager } from './db.js';
import { createHttpMcpApp, isLoopbackHost, resolveHttpBindConfig } from './server/http.js';
import { executeMemoryClearAll } from './tools/clear.js';
import { executeMemoryConsolidate } from './tools/consolidate.js';
import { executeMemoryDelete } from './tools/delete.js';
import { executeMemoryExport } from './tools/export.js';
import { executeMemoryRelate } from './tools/graph.js';
import { executeCheckRefDrift } from './tools/obsidian_bridge.js';
import { executeMemoryReindex } from './tools/reindex.js';
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

export { isLoopbackHost, resolveHttpBindConfig };
export const resolveSseBindConfig = resolveHttpBindConfig;

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
      includeSuperseded: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include temporally superseded historical memories (default: false)'),
      includeGraph: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include bounded 1-2 hop graph neighborhood and external grounded_in links'),
      graphDepth: z
        .union([z.literal(1), z.literal(2)])
        .optional()
        .default(1)
        .describe('Graph traversal hop depth when includeGraph is true (1 or 2)'),
    },
    async ({
      query,
      limit,
      threshold,
      scope,
      profile,
      mode,
      includeSuperseded,
      includeGraph,
      graphDepth,
    }) => {
      try {
        const result = await executeMemorySearch({
          query,
          limit,
          threshold,
          scope,
          profile,
          mode,
          includeSuperseded,
          includeGraph,
          graphDepth,
        });
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
    'Persist a memory into SQLite (FTS5 + optional vector) with deduplication, profile isolation, zero-copy refs, and temporal supersession',
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
      supersedes: z
        .string()
        .optional()
        .describe(
          'Optional ID of an older memory that this new fact replaces (marks old record valid_until + superseded_by)'
        ),
    },
    async ({ text, metadata, importance, scope, profile, supersedes }) => {
      try {
        const result = await executeMemoryStore({
          text,
          metadata,
          importance,
          scope,
          profile,
          supersedes,
        });
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
      checkRefs: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'When true, also runs deterministic SHA-256 drift detection on zero-copy ref pointers'
        ),
      vaultRoot: z
        .string()
        .optional()
        .describe('Optional vault root directory used when resolving zero-copy ref pointers'),
    },
    async ({ vaultPath, checkRefs, vaultRoot }) => {
      try {
        const result = await executeMemorySync({ vaultPath, checkRefs, vaultRoot });
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
    'memory_check_refs',
    'Deterministically detect SHA-256 source_hash drift on zero-copy metadata.ref pointers against Markdown/Obsidian files',
    {
      vaultRoot: z
        .string()
        .optional()
        .describe('Root directory for resolving relative vault_path and wikilink pointers'),
      scope: z
        .enum(['local', 'global', 'all'])
        .optional()
        .default('local')
        .describe('Memory scope to scan: local (default), global, or all'),
      updateHashes: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'When true, refreshes stored source_hash for stale or unhashed pointers whose files exist'
        ),
    },
    async ({ vaultRoot, scope, updateHashes }) => {
      try {
        const result = executeCheckRefDrift({ vaultRoot, scope, updateHashes });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        console.error('[MCP Error] memory_check_refs failed:', error);
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
    'memory_reindex',
    'Rebuild the local SQLite FTS5 and optional vector index from canonical Markdown files (zero-Ollama safe)',
    {
      vaultPath: z
        .string()
        .optional()
        .describe('Path to the canonical Markdown/Obsidian vault directory'),
    },
    async ({ vaultPath }) => {
      try {
        const result = await executeMemoryReindex({ vaultPath });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        console.error('[MCP Error] memory_reindex failed:', error);
        return {
          isError: true,
          content: [{ type: 'text', text: error.message || String(error) }],
        };
      }
    }
  );

  server.tool(
    'memory_consolidate',
    'Perform time decay and near-duplicate consolidation (Auto Dream: zero-LLM fallback or optional Ollama LLM synthesis)',
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
 * Builds the hardened Express app supporting MCP Streamable HTTP (`/mcp`),
 * legacy SSE (`/sse`, `/message`), and `/health`.
 */
export function createSseApp(options: { authToken?: string; corsOrigin?: string } = {}) {
  return createHttpMcpApp({
    ...options,
    version,
    createServer: createMcpServer,
  }).app;
}

/**
 * Builds the full Streamable HTTP MCP handle (Express app + session tracking + graceful teardown).
 */
export function createStreamableHttpServer(
  options: { authToken?: string; corsOrigin?: string } = {}
) {
  return createHttpMcpApp({
    ...options,
    version,
    createServer: createMcpServer,
  });
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
 * Shared local / containerized HTTP daemon serving modern MCP Streamable HTTP (`/mcp`),
 * backwards-compatible legacy SSE (`/sse`, `/message`), and `/health` with graceful shutdown.
 */
async function bootstrapHttp() {
  try {
    const { host, port, authToken, corsOrigin } = resolveHttpBindConfig(process.env);
    console.error(`[MCP Server] Bootstrapping Streamable HTTP/SSE daemon on ${host}:${port}...`);

    await DatabaseManager.getInstance();
    const handle = createStreamableHttpServer({ authToken, corsOrigin });

    const server = handle.app.listen(port, host, () => {
      console.error(
        `Cognitive Memory MCP Daemon listening on http://${host}:${port} (Streamable HTTP: /mcp, Legacy SSE: /sse, Health: /health)`
      );
    });

    const shutdown = async (signal: string) => {
      console.error(`[MCP Server] Received ${signal}; closing active sessions and SQLite...`);
      await handle.closeAllSessions();
      server.close(() => {
        DatabaseManager.close();
        process.exit(0);
      });
    };

    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    console.error('[MCP Server] Critical HTTP daemon initialization failure:', error);
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
    .then((m) => m.runInit(m.parseInitCliArgs(process.argv.slice(3))))
    .catch((err) => {
      console.error('Initialization failed:', err);
      process.exit(1);
    });
} else if (process.argv[2] === 'hook') {
  import('./hooks/lifecycle.js')
    .then(async (m) => {
      const res = await m.runLifecycleHook(process.argv[3] || 'SessionStart');
      console.error(JSON.stringify(res, null, 2));
      DatabaseManager.close();
      if (res.errors.length > 0) process.exit(1);
    })
    .catch((err) => {
      console.error('Hook execution failed:', err);
      DatabaseManager.close();
      process.exit(1);
    });
} else if (process.argv[2] === 'setup') {
  import('./cli/setup.js')
    .then((m) => m.runSetup(m.parseSetupCliArgs(process.argv.slice(3))))
    .catch((err) => {
      console.error('Setup failed:', err);
      process.exit(1);
    });
} else if (process.argv[2] === 'import-tool') {
  import('./cli/import_tool.js')
    .then(async (m) => {
      const opts = m.parseImportToolArgs(process.argv.slice(3));
      const res = await m.runImportTool(opts);
      console.error(JSON.stringify(res, null, 2));
      DatabaseManager.close();
    })
    .catch((err) => {
      console.error('Import tool failed:', err);
      DatabaseManager.close();
      process.exit(1);
    });
} else if (process.argv[2] === 'check-refs') {
  const args = process.argv.slice(3);
  const vaultIdx = args.indexOf('--vault');
  const vaultRoot = vaultIdx >= 0 ? args[vaultIdx + 1] : undefined;
  const scopeIdx = args.indexOf('--scope');
  const rawScope = scopeIdx >= 0 ? args[scopeIdx + 1] : 'local';
  const scope = rawScope === 'global' || rawScope === 'all' ? rawScope : 'local';
  const updateHashes = args.includes('--update-hashes');
  try {
    const res = executeCheckRefDrift({ vaultRoot, scope, updateHashes });
    console.error(JSON.stringify(res, null, 2));
    DatabaseManager.close();
  } catch (err) {
    console.error('Check refs failed:', err);
    DatabaseManager.close();
    process.exit(1);
  }
} else if (process.argv[2] === 'reindex') {
  executeMemoryReindex({ vaultPath: process.argv[3] })
    .then((res) => {
      console.error(JSON.stringify(res, null, 2));
      DatabaseManager.close();
    })
    .catch((err) => {
      console.error('Reindex failed:', err);
      DatabaseManager.close();
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
  process.argv.includes('--http') ||
  process.argv[2] === 'http' ||
  process.argv.includes('--sse') ||
  process.argv[2] === 'sse' ||
  process.env.TRANSPORT === 'http' ||
  process.env.MCP_TRANSPORT === 'http' ||
  process.env.TRANSPORT === 'sse' ||
  process.env.MCP_TRANSPORT === 'sse'
) {
  bootstrapHttp();
} else if (process.env.NODE_ENV !== 'test') {
  bootstrapStdio();
}
