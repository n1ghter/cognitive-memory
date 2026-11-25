import crypto from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { DatabaseManager } from '../db.js';

const LOCALHOST_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export interface HttpBindConfig {
  host: string;
  port: number;
  authToken?: string;
  corsOrigin?: string;
}

export interface HttpMcpAppOptions {
  authToken?: string;
  corsOrigin?: string;
  version: string;
  createServer: () => McpServer;
}

export interface HttpMcpAppHandle {
  app: Express;
  getSessionCounts: () => { http: number; sse: number };
  closeAllSessions: () => Promise<void>;
}

/**
 * Returns true if the given bind host is a loopback address.
 */
export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

/**
 * Resolves and validates HTTP / SSE network binding settings.
 * Refuses to bind non-loopback interfaces without MCP_AUTH_TOKEN unless explicitly opted in.
 */
export function resolveHttpBindConfig(env: NodeJS.ProcessEnv = process.env): HttpBindConfig {
  const host = env.MCP_HOST || '127.0.0.1';
  const port = Number(env.PORT || env.SSE_PORT || 3000);
  const authToken = env.MCP_AUTH_TOKEN?.trim() || undefined;
  const corsOrigin = env.MCP_CORS_ORIGIN?.trim() || undefined;

  if (!isLoopbackHost(host) && !authToken && env.MCP_ALLOW_INSECURE_REMOTE !== 'true') {
    throw new Error(
      `Refusing to bind unauthenticated MCP HTTP/SSE server to non-loopback host "${host}". ` +
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

class CorsOriginRejectedError extends Error {
  constructor(origin: string) {
    super(`Origin not allowed by CORS: ${origin}`);
    this.name = 'CorsOriginRejectedError';
  }
}

/**
 * Builds the hardened Express app serving both modern MCP Streamable HTTP (`/mcp`)
 * and backwards-compatible legacy SSE (`/sse`, `/message`) alongside `/health`.
 *
 * Security defaults:
 * - Loopback-only CORS unless explicit `corsOrigin` (`MCP_CORS_ORIGIN`) is configured.
 * - Timing-safe Bearer token auth on MCP endpoints when `authToken` is configured.
 * - Multi-client concurrent sessions backed by SQLite WAL mode.
 */
export function createHttpMcpApp(options: HttpMcpAppOptions): HttpMcpAppHandle {
  const { authToken, corsOrigin, version, createServer } = options;
  const app = express();

  const streamableSessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();
  const legacySseTransports = new Map<string, SSEServerTransport>();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (corsOrigin && origin === corsOrigin) return callback(null, true);
        if (LOCALHOST_ORIGIN_RE.test(origin)) return callback(null, true);
        return callback(new CorsOriginRejectedError(origin));
      },
      exposedHeaders: ['mcp-session-id'],
    })
  );

  // Health endpoint (non-sensitive operational status for local daemon & Docker HEALTHCHECK)
  app.get('/health', (_req, res) => {
    let journalMode = 'unknown';
    try {
      const db = DatabaseManager.getInstance();
      const row = db.pragma('journal_mode', { simple: true });
      journalMode = String(row ?? 'unknown');
    } catch {
      journalMode = 'unavailable';
    }
    res.json({
      status: 'ok',
      version,
      transports: ['streamable-http', 'sse'],
      sessions: {
        http: streamableSessions.size,
        sse: legacySseTransports.size,
      },
      database: { journal_mode: journalMode },
    });
  });

  // Enforce timing-safe Bearer auth on all MCP transport routes when configured
  if (authToken) {
    app.use((req, res, next) => {
      if (!timingSafeBearerMatch(req.headers.authorization, authToken)) {
        res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token' });
        return;
      }
      next();
    });
  }

  // ---------------------------------------------------------------------------
  // Modern MCP Streamable HTTP Transport (/mcp)
  // ---------------------------------------------------------------------------
  const mcpJsonParser = express.json({ limit: '4mb' });

  app.post('/mcp', mcpJsonParser, async (req, res) => {
    const rawSessionId = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

    try {
      if (sessionId) {
        const existing = streamableSessions.get(sessionId);
        if (!existing) {
          res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session not found' },
            id: null,
          });
          return;
        }
        await existing.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: missing mcp-session-id for non-initialize request',
          },
          id: null,
        });
        return;
      }

      const mcpServer = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          streamableSessions.set(sid, { transport, server: mcpServer });
        },
        onsessionclosed: (sid) => {
          streamableSessions.delete(sid);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          streamableSessions.delete(transport.sessionId);
        }
      };
      transport.onerror = (err) => {
        console.error(`[StreamableHTTP] Transport error (${transport.sessionId ?? 'init'}):`, err);
      };

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('[StreamableHTTP] Error handling POST /mcp:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req, res) => {
    const rawSessionId = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing mcp-session-id header' });
      return;
    }
    const existing = streamableSessions.get(sessionId);
    if (!existing) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    try {
      await existing.transport.handleRequest(req, res);
    } catch (error) {
      console.error(`[StreamableHTTP] Error handling GET /mcp (${sessionId}):`, error);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/mcp', async (req, res) => {
    const rawSessionId = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing mcp-session-id header' });
      return;
    }
    const existing = streamableSessions.get(sessionId);
    if (!existing) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    try {
      await existing.transport.handleRequest(req, res);
      streamableSessions.delete(sessionId);
    } catch (error) {
      console.error(`[StreamableHTTP] Error handling DELETE /mcp (${sessionId}):`, error);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ---------------------------------------------------------------------------
  // Backwards-Compatible Legacy SSE Transport (/sse + /message)
  // ---------------------------------------------------------------------------
  app.get('/sse', async (_req, res) => {
    console.error('[SSE] Incoming legacy SSE connection (consider upgrading client to /mcp)');
    const transport = new SSEServerTransport('/message', res);
    const sessionId = transport.sessionId;
    const mcpServer = createServer();
    legacySseTransports.set(sessionId, transport);
    transport.onclose = () => legacySseTransports.delete(sessionId);
    transport.onerror = (err) => console.error(`[SSE] Transport error for ${sessionId}:`, err);

    try {
      await mcpServer.connect(transport);
    } catch (error) {
      console.error(`[SSE] Error connecting MCP server for ${sessionId}:`, error);
      legacySseTransports.delete(sessionId);
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

    const transport = legacySseTransports.get(sessionId);
    if (!transport) {
      res.status(404).send('Session not found');
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // Clean 403 JSON response when CORS rejects a disallowed origin
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof CorsOriginRejectedError) {
      res.status(403).json({ error: err.message });
      return;
    }
    next(err);
  });

  return {
    app,
    getSessionCounts: () => ({
      http: streamableSessions.size,
      sse: legacySseTransports.size,
    }),
    closeAllSessions: async () => {
      const closers: Promise<void>[] = [];
      for (const { transport } of streamableSessions.values()) {
        closers.push(transport.close().catch(() => {}));
      }
      for (const transport of legacySseTransports.values()) {
        closers.push(transport.close().catch(() => {}));
      }
      streamableSessions.clear();
      legacySseTransports.clear();
      await Promise.all(closers);
    },
  };
}
