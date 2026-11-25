import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbeddingCache } from '../src/cache.js';
import { DatabaseManager } from '../src/db.js';
import {
  createMcpServer,
  createSseApp,
  createStreamableHttpServer,
  isLoopbackHost,
  resolveHttpBindConfig,
  resolveSseBindConfig,
} from '../src/index.js';

const MCP_HEADERS = {
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json',
};

function initializePayload(clientName: string, id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: clientName, version: '1.0.0' },
    },
  };
}

describe('MCP Server Factory, Streamable HTTP Daemon & Security (#135)', () => {
  beforeEach(() => {
    process.env.EMBEDDING_PROVIDER = 'none';
  });

  afterEach(() => {
    delete process.env.EMBEDDING_PROVIDER;
    DatabaseManager.close();
    EmbeddingCache.clear();
  });

  it('should return a distinct McpServer instance on each call', () => {
    const server1 = createMcpServer();
    const server2 = createMcpServer();

    expect(server1).toBeDefined();
    expect(server2).toBeDefined();
    expect(server1).not.toBe(server2);
  });

  it('should identify loopback vs non-loopback hosts', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('0.0.0.0')).toBe(false);
    expect(isLoopbackHost('192.168.1.10')).toBe(false);
  });

  it('should default bind host to 127.0.0.1 and reject unauthenticated non-loopback binding', () => {
    expect(resolveHttpBindConfig({}).host).toBe('127.0.0.1');
    expect(resolveSseBindConfig({}).host).toBe('127.0.0.1');
    expect(() => resolveHttpBindConfig({ MCP_HOST: '0.0.0.0' })).toThrow(
      'Refusing to bind unauthenticated MCP HTTP/SSE server'
    );
    expect(resolveHttpBindConfig({ MCP_HOST: '0.0.0.0', MCP_AUTH_TOKEN: 'secret' }).host).toBe(
      '0.0.0.0'
    );
  });

  it('should expose /health and enforce CORS + timing-safe Bearer auth on /mcp and /message', async () => {
    const app = createSseApp({ authToken: 'super-secret-token' });

    // /health returns operational status without requiring auth token
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(health.body.transports).toEqual(['streamable-http', 'sse']);

    // External CORS origin is rejected with 403
    const blockedOrigin = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example.com');
    expect(blockedOrigin.status).toBe(403);

    // Localhost CORS origin is allowed
    const localOrigin = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(localOrigin.status).toBe(200);
    expect(localOrigin.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    // Legacy SSE /message requires valid Bearer token
    const unauthMsg = await request(app).post('/message?sessionId=abc');
    expect(unauthMsg.status).toBe(401);

    const wrongMsg = await request(app)
      .post('/message?sessionId=abc')
      .set('Authorization', 'Bearer wrong-token');
    expect(wrongMsg.status).toBe(401);

    const validMsg = await request(app)
      .post('/message?sessionId=missing-session')
      .set('Authorization', 'Bearer super-secret-token');
    expect(validMsg.status).toBe(404);

    // Streamable HTTP /mcp requires valid Bearer token
    const unauthMcp = await request(app)
      .post('/mcp')
      .set(MCP_HEADERS)
      .send(initializePayload('test-client'));
    expect(unauthMcp.status).toBe(401);

    const validMcpInit = await request(app)
      .post('/mcp')
      .set({ ...MCP_HEADERS, Authorization: 'Bearer super-secret-token' })
      .send(initializePayload('auth-client'));
    expect(validMcpInit.status).toBe(200);
    expect(validMcpInit.headers['mcp-session-id']).toBeTruthy();
  });

  it('handles concurrent multi-IDE Streamable HTTP sessions cleanly against SQLite WAL mode', async () => {
    const handle = createStreamableHttpServer();
    const { app } = handle;

    try {
      // Reject non-initialize request without mcp-session-id (400) and unknown session (404)
      const missingSession = await request(app)
        .post('/mcp')
        .set(MCP_HEADERS)
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
      expect(missingSession.status).toBe(400);

      const unknownSession = await request(app)
        .post('/mcp')
        .set({ ...MCP_HEADERS, 'mcp-session-id': 'non-existent-session' })
        .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      expect(unknownSession.status).toBe(404);

      // Two independent IDEs (Antigravity + Claude Code) connect concurrently
      const [initA, initB] = await Promise.all([
        request(app).post('/mcp').set(MCP_HEADERS).send(initializePayload('antigravity')),
        request(app).post('/mcp').set(MCP_HEADERS).send(initializePayload('claude-code')),
      ]);

      expect(initA.status).toBe(200);
      expect(initB.status).toBe(200);
      const sessionA = initA.headers['mcp-session-id'];
      const sessionB = initB.headers['mcp-session-id'];
      expect(sessionA).toBeTruthy();
      expect(sessionB).toBeTruthy();
      expect(sessionA).not.toBe(sessionB);
      expect(handle.getSessionCounts().http).toBe(2);

      // Client A lists tools and stores a memory
      const listA = await request(app)
        .post('/mcp')
        .set({ ...MCP_HEADERS, 'mcp-session-id': sessionA })
        .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      expect(listA.status).toBe(200);
      const toolNames = (listA.body.result.tools as { name: string }[]).map((t) => t.name);
      expect(toolNames).toContain('memory_search');
      expect(toolNames).toContain('memory_check_refs');

      const storeA = await request(app)
        .post('/mcp')
        .set({ ...MCP_HEADERS, 'mcp-session-id': sessionA })
        .send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'memory_store',
            arguments: {
              text: 'Shared daemon decision: Streamable HTTP serves Antigravity and Claude Code simultaneously.',
              profile: 'agent_core',
            },
          },
        });
      expect(storeA.status).toBe(200);
      expect(storeA.body.result.isError).not.toBe(true);

      // Client B immediately retrieves Client A's stored memory across shared SQLite
      const searchB = await request(app)
        .post('/mcp')
        .set({ ...MCP_HEADERS, 'mcp-session-id': sessionB })
        .send({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'memory_search',
            arguments: {
              query: 'Streamable HTTP Antigravity Claude Code',
              mode: 'bm25',
            },
          },
        });
      expect(searchB.status).toBe(200);
      const payloadB = JSON.parse(searchB.body.result.content[0].text);
      expect(payloadB.results).toHaveLength(1);
      expect(payloadB.results[0].text).toContain('Streamable HTTP serves Antigravity');

      // Client A cleanly terminates its session via DELETE /mcp
      const delA = await request(app).delete('/mcp').set('mcp-session-id', sessionA);
      expect(delA.status).toBe(200);
      expect(handle.getSessionCounts().http).toBe(1);
    } finally {
      await handle.closeAllSessions();
      expect(handle.getSessionCounts().http).toBe(0);
    }
  });
});
