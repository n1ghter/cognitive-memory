import { executeMemoryExport } from './export.js';
import { executeMemoryImport } from './import.js';

interface SyncArgs {
  vaultPath?: string;
}

export async function executeMemorySync(args: SyncArgs = {}): Promise<{
  success: true;
  imported: number;
  exported: number;
  errors: string[];
}> {
  // 1. Pull changes from Obsidian into SQLite
  const importResult = await executeMemoryImport(args);

  // 2. Push changes from SQLite out to Obsidian
  const exportResult = await executeMemoryExport(args);

  return {
    success: true,
    imported: importResult.total_imported,
    exported: exportResult.total_exported,
    errors: importResult.errors,
  };
}
