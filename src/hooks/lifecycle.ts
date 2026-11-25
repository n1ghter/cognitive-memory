import { executeMemoryConsolidate } from '../tools/consolidate.js';
import { executeMemoryExport } from '../tools/export.js';

export type LifecycleEvent = 'SessionStart' | 'PreCompact' | 'Stop' | 'AutoDream';

export interface LifecycleHookResult {
  event: LifecycleEvent;
  exported: boolean;
  consolidated: boolean;
  errors: string[];
}

/**
 * Normalizes arbitrary CLI hook event strings into a valid LifecycleEvent.
 */
export function normalizeLifecycleEvent(raw?: string): LifecycleEvent {
  const cleaned = (raw || 'SessionStart').trim().toLowerCase();
  if (cleaned === 'precompact' || cleaned === 'pre-compact') return 'PreCompact';
  if (cleaned === 'stop' || cleaned === 'sessionend' || cleaned === 'session-end') return 'Stop';
  if (cleaned === 'autodream' || cleaned === 'auto-dream' || cleaned === 'consolidate') {
    return 'AutoDream';
  }
  return 'SessionStart';
}

/**
 * Executes deterministic, zero-Ollama-safe lifecycle maintenance hooks:
 * - `SessionStart`: refreshes Markdown vault export incrementally.
 * - `PreCompact`: runs zero-LLM Auto-Dream consolidation before context compaction.
 * - `Stop`: exports active memories and runs consolidation.
 * - `AutoDream`: runs consolidation and refreshes Markdown export (suitable for scheduled passes).
 */
export async function runLifecycleHook(
  rawEvent: string = 'SessionStart',
  options: { vaultPath?: string } = {}
): Promise<LifecycleHookResult> {
  const event = normalizeLifecycleEvent(rawEvent);
  const result: LifecycleHookResult = {
    event,
    exported: false,
    consolidated: false,
    errors: [],
  };

  console.error(`[Hooks] Triggered with event: ${event}`);

  try {
    if (event === 'SessionStart' || event === 'Stop') {
      console.error('[Hooks] Running memory export sync...');
      await executeMemoryExport(options.vaultPath ? { vaultPath: options.vaultPath } : undefined);
      result.exported = true;
    }

    if (event === 'PreCompact' || event === 'Stop' || event === 'AutoDream') {
      console.error('[Hooks] Running memory consolidation...');
      await executeMemoryConsolidate();
      result.consolidated = true;
    }

    if (event === 'AutoDream') {
      console.error('[Hooks] Running post-dream memory export sync...');
      await executeMemoryExport(options.vaultPath ? { vaultPath: options.vaultPath } : undefined);
      result.exported = true;
    }
  } catch (err) {
    console.error('[Hooks] Error running hooks:', err);
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}
