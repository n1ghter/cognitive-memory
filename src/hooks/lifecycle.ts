import { executeMemoryConsolidate } from '../tools/consolidate.js';
import { executeMemoryExport } from '../tools/export.js';

export type LifecycleEvent = 'SessionStart' | 'PreCompact' | 'Stop' | 'AutoDream';
export type HookClient = 'generic' | 'claude' | 'antigravity';

export interface AntigravityHookInput {
  conversationId?: string;
  workspacePaths?: string[];
  hookEventName?: string;
  cwd?: string;
  terminationReason?: string;
  continuationActive?: boolean;
  fullyIdle?: boolean;
}

export interface LifecycleHookOptions {
  vaultPath?: string;
  client?: HookClient;
  stdoutJson?: boolean;
  stdinPayload?: AntigravityHookInput | null;
}

export interface LifecycleHookResult {
  event: LifecycleEvent;
  exported: boolean;
  consolidated: boolean;
  skipped?: boolean;
  errors: string[];
}

export interface ParsedHookCliArgs {
  event: LifecycleEvent;
  client: HookClient;
  stdoutJson: boolean;
  vaultPath?: string;
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
 * Parses CLI flags passed after `cognitive-memory hook`.
 */
export function parseHookCliArgs(argv: string[]): ParsedHookCliArgs {
  let rawEvent: string | undefined;
  let client: HookClient = 'generic';
  let stdoutJson = false;
  let vaultPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--stdout-json') {
      stdoutJson = true;
    } else if (arg === '--client' && argv[i + 1]) {
      const val = argv[++i].trim().toLowerCase();
      if (val === 'antigravity' || val === 'claude' || val === 'generic') client = val;
    } else if (arg.startsWith('--client=')) {
      const val = arg.slice('--client='.length).trim().toLowerCase();
      if (val === 'antigravity' || val === 'claude' || val === 'generic') client = val;
    } else if (arg === '--vault' && argv[i + 1]) {
      vaultPath = argv[++i];
    } else if (arg.startsWith('--vault=')) {
      vaultPath = arg.slice('--vault='.length);
    } else if (!arg.startsWith('-') && !rawEvent) {
      rawEvent = arg;
    }
  }

  if (client === 'antigravity') {
    stdoutJson = true;
  }

  return {
    event: normalizeLifecycleEvent(rawEvent),
    client,
    stdoutJson,
    vaultPath,
  };
}

/**
 * Formats the contract-compliant stdout JSON object expected by Antigravity 2.0 `hooks.json`:
 * - `Stop`: `{ "decision": "allow" }` (satisfies required `decision` field without blocking stop)
 * - `SessionStart` / others: `{}`
 */
export function formatAntigravityHookOutput(event: LifecycleEvent): Record<string, unknown> {
  if (event === 'Stop') {
    return { decision: 'allow' };
  }
  return {};
}

/**
 * Returns true if a synchronous `Stop` hook should fast-skip heavy work (e.g., user canceled or errored turn).
 */
export function shouldSkipHookForInput(
  event: LifecycleEvent,
  input?: AntigravityHookInput | null
): boolean {
  if (!input || event !== 'Stop') return false;
  if (input.continuationActive) return true;
  if (input.terminationReason && input.terminationReason !== 'NO_TOOL_CALL') {
    return true;
  }
  return false;
}

/**
 * Reads optional JSON payload from stdin with a tight timeout so standalone CLI invocations never hang.
 */
export async function readStdinJsonSafe(timeoutMs = 200): Promise<AntigravityHookInput | null> {
  if (process.stdin.isTTY) return null;

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const finish = (raw: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
      try {
        const trimmed = raw.trim();
        resolve(trimmed ? (JSON.parse(trimmed) as AntigravityHookInput) : null);
      } catch {
        resolve(null);
      }
    };

    const onData = (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    };
    const onEnd = () => finish(Buffer.concat(chunks).toString('utf-8'));
    const onError = () => finish('');

    const timer = setTimeout(() => {
      process.stdin.pause();
      finish(Buffer.concat(chunks).toString('utf-8'));
    }, timeoutMs);

    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.once('error', onError);
    process.stdin.resume();
  });
}

/**
 * Executes deterministic, zero-Ollama-safe lifecycle maintenance hooks:
 * - `SessionStart`: refreshes Markdown vault export incrementally.
 * - `PreCompact`: runs zero-LLM Auto-Dream consolidation before context compaction.
 * - `Stop`: exports active memories and runs consolidation (fast-skips canceled/error turns in Antigravity).
 * - `AutoDream`: runs consolidation and refreshes Markdown export (suitable for scheduled passes).
 */
export async function runLifecycleHook(
  rawEvent: string = 'SessionStart',
  options: LifecycleHookOptions = {}
): Promise<LifecycleHookResult> {
  const event = normalizeLifecycleEvent(rawEvent);
  const result: LifecycleHookResult = {
    event,
    exported: false,
    consolidated: false,
    errors: [],
  };

  console.error(`[Hooks] Triggered with event: ${event}`);

  if (shouldSkipHookForInput(event, options.stdinPayload)) {
    result.skipped = true;
    console.error('[Hooks] Fast-skipping maintenance for non-normal Stop termination.');
    return result;
  }

  // Synchronous IDE hooks (especially Antigravity) must never block waiting on remote/offline Ollama
  const prevProvider = process.env.EMBEDDING_PROVIDER;
  const forceOffline = options.client === 'antigravity' && !prevProvider;
  if (forceOffline) {
    process.env.EMBEDDING_PROVIDER = 'none';
  }

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
  } finally {
    if (forceOffline) {
      delete process.env.EMBEDDING_PROVIDER;
    }
  }

  return result;
}
