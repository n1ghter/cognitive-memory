import { executeMemoryExport } from './export.js';
import { executeMemoryImport } from './import.js';
import { type CheckRefDriftResult, executeCheckRefDrift } from './obsidian_bridge.js';

interface SyncArgs {
  vaultPath?: string;
  /** Optional root directory for resolving zero-copy `metadata.ref` pointers during drift check. */
  vaultRoot?: string;
  /** When true, also runs deterministic SHA-256 drift detection on zero-copy `ref` pointers. */
  checkRefs?: boolean;
}

export async function executeMemorySync(args: SyncArgs = {}): Promise<{
  success: true;
  imported: number;
  exported: number;
  errors: string[];
  ref_drift?: CheckRefDriftResult['summary'];
}> {
  // 1. Pull changes from Obsidian into SQLite
  const importResult = await executeMemoryImport(args);

  // 2. Push changes from SQLite out to Obsidian
  const exportResult = await executeMemoryExport(args);

  // 3. Optional zero-copy SHA-256 ref drift check
  const refDrift = args.checkRefs
    ? executeCheckRefDrift({ vaultRoot: args.vaultRoot ?? args.vaultPath }).summary
    : undefined;

  return {
    success: true,
    imported: importResult.total_imported,
    exported: exportResult.total_exported,
    errors: importResult.errors,
    ...(refDrift ? { ref_drift: refDrift } : {}),
  };
}
