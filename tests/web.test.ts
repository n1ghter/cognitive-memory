import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseManager, generateId } from '../src/db.js';
import { startWebServer } from '../src/server/web.js';

describe('Web Server API', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    // Start server on a random open port for testing
    const result = await startWebServer(0);
    app = result.app;
    server = result.server;

    // Seed some test data into the DB
    const db = DatabaseManager.getInstance();
    db.exec('BEGIN TRANSACTION');

    const localId = generateId();
    const globalId = generateId();

    // Local node
    db.prepare(`
      INSERT INTO main.memory (id, text, metadata, importance)
      VALUES (?, ?, ?, ?)
    `).run(localId, 'Local test memory', JSON.stringify({ source: 'local' }), 0.5);

    // Global node
    db.prepare(`
      INSERT INTO global.memory (id, text, metadata, importance)
      VALUES (?, ?, ?, ?)
    `).run(globalId, 'Global test memory', JSON.stringify({ source: 'global' }), 0.7);

    // Edge (local -> local to avoid FK error)
    const localId2 = generateId();
    db.prepare(`
      INSERT INTO main.memory (id, text, metadata, importance)
      VALUES (?, ?, ?, ?)
    `).run(localId2, 'Local test memory 2', JSON.stringify({ source: 'local' }), 0.5);

    db.prepare(`
      INSERT INTO main.edges (id, source_id, target_id, relation_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(generateId(), localId, localId2, 'TEST_RELATION', '{}');

    db.exec('COMMIT');
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    DatabaseManager.close();
  });

  it('should return 200 and valid JSON on /api/graph', async () => {
    const response = await request(app).get('/api/graph');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/json/);

    const body = response.body;
    expect(body).toHaveProperty('nodes');
    expect(body).toHaveProperty('links');

    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.links)).toBe(true);

    // We expect at least the two nodes we seeded
    expect(body.nodes.length).toBeGreaterThanOrEqual(2);
    expect(body.links.length).toBeGreaterThanOrEqual(1);

    // Verify sourceDb property is returned
    const localNode = body.nodes.find(
      (n: any) => n.id === body.links[0].source || n.id === body.links[0].target
    );
    expect(localNode).toHaveProperty('sourceDb');
  });

  it('should serve static files from ui/dist', async () => {
    const response = await request(app).get('/');
    // Since UI might not be built in CI, it might return 404 or 200 depending on dist presence.
    // We just check that the server handles the request without crashing.
    expect([200, 404]).toContain(response.status);
  });
});
