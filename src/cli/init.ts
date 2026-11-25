import fs from 'node:fs';
import path from 'node:path';

export type InitAgentTarget = 'antigravity' | 'claude' | 'cursor';

export interface InitOptions {
  cwd?: string;
  includeHooks?: boolean;
  agents?: InitAgentTarget[];
}

export interface InitResult {
  createdOrUpdated: string[];
  unchanged: string[];
}

export const MANAGED_BLOCK_START = '<!-- cognitive-memory:start -->';
export const MANAGED_BLOCK_END = '<!-- cognitive-memory:end -->';

const HOOK_COMMAND_PREFIX = 'npx -y @cemised/cognitive-memory hook';

/**
 * Concise, anti-smell skill template (valid single-line YAML frontmatter, zero bloat).
 */
export const SKILL_TEMPLATE = `---
name: memory-auto-capture
description: "Local-first cross-tool memory via cognitive-memory MCP (SQLite FTS5 BM25 + optional Hybrid RRF, temporal supersession, Markdown-first storage). Works offline without Ollama."
---

# Memory Auto-Capture (\`cognitive-memory\`)

Use \`cognitive-memory\` MCP tools on demand without inflating static prompts:

- **Retrieve:** Call \`memory_search\` (\`mode: "hybrid"\`, \`scope: "all"\`, \`limit: 5\`; add \`includeGraph: true\` for linked context) when past decisions, conventions, or prior fixes matter.
- **Capture:** Call \`memory_store\` with atomic facts and rationale (\`scope: "local"\`, \`profile: "agent_core"\` for repo invariants; \`scope: "global"\`, \`profile: "user"\` for cross-project preferences).
- **Supersede:** Pass \`supersedes: "<old_id>"\` on \`memory_store\` whenever a decision changes so stale facts never linger.
- **Maintain:** Run \`memory_consolidate\` (zero-LLM Auto-Dream safe) and \`memory_sync\` / \`memory_reindex\` to keep Markdown notes and SQLite aligned.
`;

/**
 * Ultra-concise prescriptive AGENTS.md managed block (anti-smell: avoids verbose checklists per
 * arXiv:2602.11988, arXiv:2606.15828, and arXiv:2611.04367).
 */
export const AGENTS_MD_MANAGED_BLOCK = `${MANAGED_BLOCK_START}
## Cognitive Memory
Use the \`cognitive-memory\` MCP server (offline-safe FTS5 + optional hybrid RRF) on demand:
- Query \`memory_search\` (\`scope: "all"\`) before architectural choices or repeating investigations.
- Store confirmed decisions and non-obvious fixes atomically via \`memory_store\`; replace changed facts using \`supersedes\`.
${MANAGED_BLOCK_END}`;

/**
 * Concise Cursor rule (.cursor/rules/cognitive-memory.mdc) with alwaysApply: false to avoid Context Rot.
 */
export const CURSOR_RULE_TEMPLATE = `---
description: "Use cognitive-memory MCP on demand for cross-tool project memory, decisions, and bug-fix recall."
alwaysApply: false
---

# Cognitive Memory Rule

- Call \`memory_search\` (\`mode: "hybrid"\`, \`scope: "all"\`) when recalling architecture decisions, user preferences, or previous fixes.
- Call \`memory_store\` for durable decisions and verified root-cause fixes; pass \`supersedes\` when replacing outdated facts.
- Run \`npx -y @cemised/cognitive-memory hook AutoDream\` for offline zero-LLM consolidation and Markdown export.
`;

interface ClaudeHookEntry {
  type: 'command';
  command: string;
}

interface ClaudeHookMatcherGroup {
  matcher?: string;
  hooks: ClaudeHookEntry[];
}

const CLAUDE_HOOK_SPEC: Record<'SessionStart' | 'PreCompact' | 'Stop', string> = {
  SessionStart: `${HOOK_COMMAND_PREFIX} SessionStart`,
  PreCompact: `${HOOK_COMMAND_PREFIX} PreCompact`,
  Stop: `${HOOK_COMMAND_PREFIX} Stop`,
};

/**
 * Upserts the deterministic managed block into AGENTS.md, migrating any legacy
 * `## Autonomous Memory Checklist` section in place while preserving surrounding user content.
 */
export function upsertAgentsManagedBlock(existingContent: string): string {
  const normalized = existingContent.replace(/\r\n/g, '\n');

  // 1. Replace existing managed block in place
  const managedRe = new RegExp(
    `${escapeRegExp(MANAGED_BLOCK_START)}[\\s\\S]*?${escapeRegExp(MANAGED_BLOCK_END)}`
  );
  if (managedRe.test(normalized)) {
    return `${normalized.replace(managedRe, AGENTS_MD_MANAGED_BLOCK).trimEnd()}\n`;
  }

  // 2. Replace legacy verbose v1.x checklist block if present
  const legacyRe = /\n*## Autonomous Memory Checklist[\s\S]*?(?=\n## |\n# |$)/;
  if (legacyRe.test(normalized)) {
    const replaced = normalized.replace(legacyRe, `\n\n${AGENTS_MD_MANAGED_BLOCK}`);
    return `${replaced.trim()}\n`;
  }

  // 3. Append cleanly to existing content or create new file
  const trimmed = normalized.trimEnd();
  if (!trimmed) {
    return `${AGENTS_MD_MANAGED_BLOCK}\n`;
  }
  return `${trimmed}\n\n${AGENTS_MD_MANAGED_BLOCK}\n`;
}

/**
 * Deterministically merges cognitive-memory lifecycle hooks into `.claude/settings.json`
 * without disturbing any user-defined settings or hooks.
 */
export function mergeClaudeSettingsHooks(existingJsonText: string): string {
  let settings: Record<string, any> = {};
  if (existingJsonText.trim()) {
    settings = JSON.parse(existingJsonText);
  }
  if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) {
    settings.hooks = {};
  }

  for (const [event, command] of Object.entries(CLAUDE_HOOK_SPEC)) {
    const currentGroups: ClaudeHookMatcherGroup[] = Array.isArray(settings.hooks[event])
      ? settings.hooks[event]
      : [];

    const hasCommand = currentGroups.some(
      (group) =>
        Array.isArray(group?.hooks) &&
        group.hooks.some(
          (h) => typeof h?.command === 'string' && h.command.includes(HOOK_COMMAND_PREFIX)
        )
    );

    if (hasCommand) {
      // Update existing cognitive-memory hook entry in place for deterministic idempotency
      settings.hooks[event] = currentGroups.map((group) => {
        if (!Array.isArray(group?.hooks)) return group;
        return {
          ...group,
          hooks: group.hooks.map((h) =>
            typeof h?.command === 'string' && h.command.includes(HOOK_COMMAND_PREFIX)
              ? { type: 'command', command }
              : h
          ),
        };
      });
    } else {
      settings.hooks[event] = [
        ...currentGroups,
        {
          hooks: [{ type: 'command', command }],
        },
      ];
    }
  }

  return `${JSON.stringify(settings, null, 2)}\n`;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeIfChanged(filePath: string, nextContent: string, result: InitResult): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf-8');
    if (current === nextContent) {
      result.unchanged.push(filePath);
      return;
    }
  }
  fs.writeFileSync(filePath, nextContent, 'utf-8');
  result.createdOrUpdated.push(filePath);
}

/**
 * Parses CLI flags passed after `cognitive-memory init`.
 */
export function parseInitCliArgs(argv: string[]): InitOptions {
  const includeHooks = !argv.includes('--no-hooks');
  const agentsArg = argv.find((a) => a.startsWith('--agents='));
  let agents: InitAgentTarget[] | undefined;
  if (agentsArg) {
    const parsed = agentsArg
      .slice('--agents='.length)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is InitAgentTarget => s === 'antigravity' || s === 'claude' || s === 'cursor');
    if (parsed.length > 0) agents = parsed;
  }
  return { includeHooks, agents };
}

/**
 * Initializes lean, anti-smell cognitive-memory templates and deterministic lifecycle hook scaffolds.
 * 100% deterministic and idempotent: running twice produces byte-identical files.
 */
export async function runInit(options: InitOptions = {}): Promise<InitResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const includeHooks = options.includeHooks ?? true;
  const agents = new Set<InitAgentTarget>(options.agents ?? ['antigravity', 'claude', 'cursor']);
  const result: InitResult = { createdOrUpdated: [], unchanged: [] };

  console.error('Initializing concise cognitive-memory templates and lifecycle hooks...');

  // 1. Universal AGENTS.md managed block (anti-smell, idempotent)
  const agentsMdPath = path.join(cwd, 'AGENTS.md');
  const existingAgentsMd = fs.existsSync(agentsMdPath)
    ? fs.readFileSync(agentsMdPath, 'utf-8')
    : '';
  const nextAgentsMd = upsertAgentsManagedBlock(existingAgentsMd);
  writeIfChanged(agentsMdPath, nextAgentsMd, result);

  // 2. Antigravity / universal .agents/skills/memory-auto-capture/SKILL.md
  if (agents.has('antigravity')) {
    const skillPath = path.join(cwd, '.agents', 'skills', 'memory-auto-capture', 'SKILL.md');
    writeIfChanged(skillPath, SKILL_TEMPLATE, result);
  }

  // 3. Deterministic lifecycle hooks & IDE rules (Claude Code + Cursor)
  if (includeHooks && agents.has('claude')) {
    const claudeSettingsPath = path.join(cwd, '.claude', 'settings.json');
    const existingClaude = fs.existsSync(claudeSettingsPath)
      ? fs.readFileSync(claudeSettingsPath, 'utf-8')
      : '';
    const nextClaude = mergeClaudeSettingsHooks(existingClaude);
    writeIfChanged(claudeSettingsPath, nextClaude, result);
  }

  if (includeHooks && agents.has('cursor')) {
    const cursorRulePath = path.join(cwd, '.cursor', 'rules', 'cognitive-memory.mdc');
    writeIfChanged(cursorRulePath, CURSOR_RULE_TEMPLATE, result);
  }

  console.error(
    `Init complete: ${result.createdOrUpdated.length} created/updated, ${result.unchanged.length} unchanged.`
  );
  return result;
}
