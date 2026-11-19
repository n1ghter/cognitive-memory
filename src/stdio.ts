#!/usr/bin/env node
/**
 * Stdio Transport Entry Point for Cognitive Memory MCP Server
 *
 * CRITICAL STDOUT SAFEGUARD:
 * Stdout is strictly reserved for JSON-RPC 2.0 message packet transport.
 * All logging output is redirected to stderr to prevent stdout contamination.
 */
console.log = console.error;

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DatabaseManager } from './db.js';
import { createMcpServer } from './index.js';

/**
 * Bootstrap function for stdio transport MCP server.
 */
async function bootstrapStdio() {
  try {
    console.error('[MCP Stdio Server] Initializing database...');
    await DatabaseManager.getInstance();

    const mcpServer = createMcpServer();
    const transport = new StdioServerTransport();

    console.error('[MCP Stdio Server] Connecting StdioServerTransport...');
    await mcpServer.connect(transport);
    console.error('[MCP Stdio Server] Stdio server connected and listening.');
  } catch (error) {
    console.error('[MCP Stdio Server] Critical initialization failure:', error);
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

bootstrapStdio();
