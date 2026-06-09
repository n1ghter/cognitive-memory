import { DatabaseManager } from '../db.js';
import { executeMemoryConsolidate } from '../tools/consolidate.js';
import { executeMemoryExport } from '../tools/export.js';

/**
 * Runs the hooks for memory export and consolidation.
 */
async function runHooks() {
  const event = process.argv[2] || 'SessionStart';
  console.error(`[Hooks] Triggered with event: ${event}`);

  try {
    if (event === 'SessionStart' || event === 'Stop') {
      console.error('[Hooks] Running memory export sync...');
      await executeMemoryExport();
    }

    if (event === 'PreCompact' || event === 'Stop') {
      console.error('[Hooks] Running memory consolidation...');
      await executeMemoryConsolidate();
    }
  } catch (err) {
    console.error('[Hooks] Error running hooks:', err);
  } finally {
    await DatabaseManager.close();
    process.exit(0);
  }
}

runHooks();
