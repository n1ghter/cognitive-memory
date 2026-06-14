import { DatabaseManager } from '../src/db.js';
import { executeMemoryExport } from '../src/tools/export.js';
import { executeMemoryRelate } from '../src/tools/graph.js';
import { executeMemoryStore } from '../src/tools/store.js';

async function main() {
  // Clear the database first to have a clean slate for the demo
  const db = DatabaseManager.getInstance();
  db.exec('DELETE FROM edges');
  db.exec('DELETE FROM vec_memory');
  db.exec('DELETE FROM memory');

  console.log('1. Storing first memory...');
  const mem1 = await executeMemoryStore({
    text: 'User prefers dark mode for all their IDEs, specifically Dracula theme.',
    metadata: { type: 'preference', context: 'developer_tools' },
  });

  console.log('2. Storing second memory...');
  const mem2 = await executeMemoryStore({
    text: 'User is building an AI memory agent in TypeScript.',
    metadata: { type: 'project', status: 'active' },
  });

  console.log('3. Storing third memory...');
  const mem3 = await executeMemoryStore({
    text: 'User wants the AI memory agent to have a dark UI to match their IDE preference.',
    metadata: { type: 'requirement', priority: 'high' },
  });

  console.log('4. Creating graph relations...');
  await executeMemoryRelate({
    sourceId: mem1.record.id,
    targetId: mem3.record.id,
    relationType: 'influences_design',
  });

  await executeMemoryRelate({
    sourceId: mem2.record.id,
    targetId: mem3.record.id,
    relationType: 'has_requirement',
  });

  console.log('5. Running Export tool...');
  const result = await executeMemoryExport();

  console.log('Export finished:', result);
}

main().catch(console.error);
