import { DatabaseManager } from '../db.js';
import { runLifecycleHook } from './lifecycle.js';

/**
 * Standalone entry point for agent lifecycle hooks (`SessionStart`, `PreCompact`, `Stop`, `AutoDream`).
 */
async function runHooks() {
  const event = process.argv[2] || 'SessionStart';
  try {
    await runLifecycleHook(event);
  } finally {
    await DatabaseManager.close();
    process.exit(0);
  }
}

runHooks();
