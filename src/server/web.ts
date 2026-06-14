import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { DatabaseManager } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startWebServer(port: number = 3000) {
  const app = express();
  app.use(cors());

  // API Endpoint to fetch the graph
  app.get('/api/graph', (req, res) => {
    try {
      const db = DatabaseManager.getInstance();
      
      const nodes = db.prepare(`
        SELECT id, text, metadata, importance, is_active, 'local' as source_db FROM main.memory
        UNION ALL
        SELECT id, text, metadata, importance, is_active, 'global' as source_db FROM global.memory
      `).all();
      
      const links = db.prepare(`
        SELECT id, source_id as source, target_id as target, relation_type, metadata, 'local' as source_db FROM main.edges
        UNION ALL
        SELECT id, source_id as source, target_id as target, relation_type, metadata, 'global' as source_db FROM global.edges
      `).all();

      res.json({
        nodes: nodes.map((n: any) => ({
          id: n.id,
          name: n.text.substring(0, 50) + (n.text.length > 50 ? '...' : ''),
          fullText: n.text,
          val: Math.max(1, (n.importance || 0.5) * 10),
          metadata: n.metadata,
          isActive: n.is_active === 1,
          sourceDb: n.source_db
        })),
        links: links.map((l: any) => ({
          id: l.id,
          source: l.source,
          target: l.target,
          label: l.relation_type,
          metadata: l.metadata,
          sourceDb: l.source_db
        }))
      });
    } catch (err: any) {
      console.error('Error fetching graph:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Serve static files from the UI dist directory
  const uiDistPath = path.join(__dirname, '../../ui/dist');
  app.use(express.static(uiDistPath));

  // Fallback for SPA
  app.use((req, res) => {
    res.sendFile(path.join(uiDistPath, 'index.html'));
  });

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Web UI Dashboard is running at ${url}`);
      
      // Auto-open browser
      import('child_process').then(({ exec }) => {
        const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${start} ${url}`);
      }).catch(err => console.error('Failed to open browser:', err));
    }
  });

  return { app, server };
}
