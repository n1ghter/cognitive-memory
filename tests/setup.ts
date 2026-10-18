import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate local DB to in-memory
process.env.MEMORY_DB_PATH = ':memory:';

// Isolate global DB to a temporary directory to prevent test pollution
// of the real ~/.cognitive-memory/global-memory.sqlite
const testGlobalDir = path.join(os.tmpdir(), `cognitive-memory-test-${process.pid}`);
fs.mkdirSync(testGlobalDir, { recursive: true });
process.env.GLOBAL_MEMORY_DB_DIR = testGlobalDir;
