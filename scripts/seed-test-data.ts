import { DatabaseManager, generateId } from '../src/db.js';

// Random float array generator for testing
function generateEmbedding(length: number = 4096): number[] {
  return Array.from({ length }, () => Math.random() - 0.5);
}

const db = DatabaseManager.getInstance();

console.log('Seeding Local and Global Databases...');

const numNodes = 10;
const localNodes: string[] = [];
const globalNodes: string[] = [];

try {
  db.exec('BEGIN TRANSACTION');

  // Insert Local Nodes
  for (let i = 0; i < numNodes; i++) {
    const id = generateId();
    localNodes.push(id);
    const metadata = JSON.stringify({ category: 'local_test', index: i });

    const infoLocal = db
      .prepare(`
      INSERT INTO main.memory (id, text, metadata, importance)
      VALUES (?, ?, ?, ?)
    `)
      .run(id, `Local memory node ${i} covering some context.`, metadata, 0.6);

    db.prepare(`
      INSERT INTO main.vec_memory (rowid, embedding)
      VALUES (?, ?)
    `).run(BigInt(infoLocal.lastInsertRowid), new Float32Array(generateEmbedding()));
  }

  // Insert Global Nodes
  for (let i = 0; i < numNodes; i++) {
    const id = generateId();
    globalNodes.push(id);
    const metadata = JSON.stringify({ category: 'global_test', index: i });

    const infoGlobal = db
      .prepare(`
      INSERT INTO global.memory (id, text, metadata, importance)
      VALUES (?, ?, ?, ?)
    `)
      .run(id, `Global memory node ${i} covering overarching context.`, metadata, 0.8);

    db.prepare(`
      INSERT INTO global.vec_memory (rowid, embedding)
      VALUES (?, ?)
    `).run(BigInt(infoGlobal.lastInsertRowid), new Float32Array(generateEmbedding()));
  }

  // Create Edges (Local to Local)
  for (let i = 0; i < numNodes - 1; i++) {
    db.prepare(`
      INSERT INTO main.edges (id, source_id, target_id, relation_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(generateId(), localNodes[i], localNodes[i + 1], 'RELATES_TO', '{}');
  }

  // Create Edges (Global to Global)
  for (let i = 0; i < numNodes - 1; i++) {
    db.prepare(`
      INSERT INTO global.edges (id, source_id, target_id, relation_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(generateId(), globalNodes[i], globalNodes[i + 1], 'RELATES_TO', '{}');
  }

  db.exec('COMMIT');
  console.log('Seeding completed successfully!');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('Seeding failed:', error);
} finally {
  DatabaseManager.close();
}
