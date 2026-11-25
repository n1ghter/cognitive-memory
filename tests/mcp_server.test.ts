import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createMcpServer,
  createSseApp,
  isLoopbackHost,
  resolveSseBindConfig,
} from '../src/index.js';

describe('MCP Server Factory & SSE Security', () => {
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

  it('should default SSE bind host to 127.0.0.1 and reject unauthenticated non-loopback binding', () => {
    expect(resolveSseBindConfig({}).host).toBe('127.0.0.1');
    expect(() => resolveSseBindConfig({ MCP_HOST: '0.0.0.0' })).toThrow(
      'Refusing to bind unauthenticated MCP SSE server'
    );
    expect(resolveSseBindConfig({ MCP_HOST: '0.0.0.0', MCP_AUTH_TOKEN: 'secret' }).host).toBe(
      '0.0.0.0'
    );
  });

  it('should enforce Bearer token auth on SSE endpoints when authToken is configured', async () => {
    const app = createSseApp({ authToken: 'super-secret-token' });

    const unauth = await request(app).post('/message?sessionId=abc');
    expect(unauth.status).toBe(401);

    const wrong = await request(app)
      .post('/message?sessionId=abc')
      .set('Authorization', 'Bearer wrong-token');
    expect(wrong.status).toBe(401);

    const valid = await request(app)
      .post('/message?sessionId=missing-session')
      .set('Authorization', 'Bearer super-secret-token');
    expect(valid.status).toBe(404);
  });
});
