import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'memory.sqlite');
const db = new Database(dbPath);

interface MemoryRow {
  id: string;
  text: string;
  metadata: string;
  importance: number;
  created: string;
}

const rows = db
  .prepare(`
  SELECT 
    id, 
    text, 
    metadata, 
    importance, 
    datetime(created_at, 'localtime') as created
  FROM memory 
  WHERE is_active = 1
  ORDER BY created_at DESC 
  LIMIT 15
`)
  .all() as MemoryRow[];

console.log(`\n=== Последние 15 активных воспоминаний ===\n`);

rows.forEach((r, i) => {
  let metaStr = '';
  try {
    const meta = JSON.parse(r.metadata);
    if (Object.keys(meta).length > 0) {
      metaStr = ` [Meta: ${JSON.stringify(meta)}]`;
    }
  } catch (_e) {}

  console.log(`${i + 1}. [${r.created}] (Важность: ${r.importance.toFixed(2)})${metaStr}`);
  console.log(`   📝 ${r.text.replace(/\n/g, '\n      ')}`);
  console.log('---');
});
