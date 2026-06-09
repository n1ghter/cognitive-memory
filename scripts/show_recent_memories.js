const Database = require('better-sqlite3');
const path = require('node:path');

const dbPath = path.join(__dirname, 'memory.sqlite');
const db = new Database(dbPath);

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
  .all();

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
