import { describe, expect, it } from 'vitest';
import { createMcpServer } from '../src/index.js';

describe('createMcpServer', () => {
  it('should return a new McpServer instance on each call', () => {
    const server1 = createMcpServer();
    const server2 = createMcpServer();

    expect(server1).toBeDefined();
    expect(server2).toBeDefined();
    expect(server1).not.toBe(server2);
  });
});
