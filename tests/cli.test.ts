import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGENTS_MD_MANAGED_BLOCK,
  CURSOR_RULE_TEMPLATE,
  MANAGED_BLOCK_END,
  MANAGED_BLOCK_START,
  mergeAntigravityHooksJson,
  mergeClaudeSettingsHooks,
  parseInitCliArgs,
  runInit,
  SKILL_TEMPLATE,
  upsertAgentsManagedBlock,
} from '../src/cli/init.js';
import { parseSetupCliArgs, runSetup } from '../src/cli/setup.js';
import {
  formatAntigravityHookOutput,
  normalizeLifecycleEvent,
  parseHookCliArgs,
  runLifecycleHook,
  shouldSkipHookForInput,
} from '../src/hooks/lifecycle.js';

describe('CLI Scripts', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-cli-test-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('init.ts (anti-smell templates, idempotency & lifecycle hooks #133)', () => {
    it('creates concise anti-smell templates and deterministic lifecycle hook scaffolds', async () => {
      const res = await runInit({ cwd: tmpDir });

      expect(res.createdOrUpdated).toHaveLength(5);
      expect(res.unchanged).toHaveLength(0);

      const agentsMd = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8');
      const skillMd = fs.readFileSync(
        path.join(tmpDir, '.agents', 'skills', 'memory-auto-capture', 'SKILL.md'),
        'utf-8'
      );
      const agyHooks = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.agents', 'hooks.json'), 'utf-8')
      );
      const claudeSettings = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf-8')
      );
      const cursorRule = fs.readFileSync(
        path.join(tmpDir, '.cursor', 'rules', 'cognitive-memory.mdc'),
        'utf-8'
      );

      // Anti-smell verification: concise, zero verbose checkbox forcing-function bloat
      expect(AGENTS_MD_MANAGED_BLOCK.length).toBeLessThan(500);
      expect(agentsMd).toContain(MANAGED_BLOCK_START);
      expect(agentsMd).toContain(MANAGED_BLOCK_END);
      expect(agentsMd).not.toContain('- [ ]');
      expect(agentsMd).not.toContain('DO NOT conclude');

      // Valid single-line YAML frontmatter in SKILL.md and Cursor .mdc
      expect(skillMd).toBe(SKILL_TEMPLATE);
      expect(skillMd).toMatch(/^---\nname: memory-auto-capture\ndescription: "[^"\n]+"\n---/);
      expect(cursorRule).toBe(CURSOR_RULE_TEMPLATE);
      expect(cursorRule).toContain('alwaysApply: false');

      // Antigravity 2.0 native .agents/hooks.json: flat SessionStart/Stop arrays, no PreCompact, no npx -y, safe opt-in default
      expect(agyHooks['cognitive-memory'].enabled).toBe(false);
      expect(agyHooks['cognitive-memory'].PreCompact).toBeUndefined();
      expect(agyHooks['cognitive-memory'].SessionStart[0].command).toContain(
        'hook SessionStart --client antigravity'
      );
      expect(agyHooks['cognitive-memory'].SessionStart[0].command).not.toContain('npx');
      expect(agyHooks['cognitive-memory'].Stop[0].command).toContain(
        'hook Stop --client antigravity'
      );

      // Claude Code deterministic lifecycle hooks (SessionStart, PreCompact, Stop)
      expect(claudeSettings.hooks.SessionStart[0].hooks[0].command).toContain('hook SessionStart');
      expect(claudeSettings.hooks.PreCompact[0].hooks[0].command).toContain('hook PreCompact');
      expect(claudeSettings.hooks.Stop[0].hooks[0].command).toContain('hook Stop');
    });

    it('is 100% deterministic and idempotent (running twice produces byte-identical files)', async () => {
      await runInit({ cwd: tmpDir });

      const files = [
        path.join(tmpDir, 'AGENTS.md'),
        path.join(tmpDir, '.agents', 'skills', 'memory-auto-capture', 'SKILL.md'),
        path.join(tmpDir, '.agents', 'hooks.json'),
        path.join(tmpDir, '.claude', 'settings.json'),
        path.join(tmpDir, '.cursor', 'rules', 'cognitive-memory.mdc'),
      ];
      const firstSnapshots = files.map((f) => fs.readFileSync(f));

      const secondRes = await runInit({ cwd: tmpDir });
      expect(secondRes.createdOrUpdated).toEqual([]);
      expect(secondRes.unchanged).toHaveLength(5);

      const secondSnapshots = files.map((f) => fs.readFileSync(f));
      for (let i = 0; i < files.length; i++) {
        expect(secondSnapshots[i].equals(firstSnapshots[i])).toBe(true);
      }
    });

    it('merges Antigravity hooks.json non-destructively alongside existing user hooks', () => {
      const existing = JSON.stringify(
        {
          'lint-checker': {
            PostToolUse: [
              { matcher: 'run_command', hooks: [{ type: 'command', command: './lint.sh' }] },
            ],
          },
        },
        null,
        2
      );
      const merged = mergeAntigravityHooksJson(existing, {
        commandPrefix: 'node /app/dist/index.js',
        enabled: true,
      });
      const parsed = JSON.parse(merged);
      expect(parsed['lint-checker']).toBeDefined();
      expect(parsed['cognitive-memory'].enabled).toBe(true);
      expect(parsed['cognitive-memory'].Stop[0].command).toBe(
        'node /app/dist/index.js hook Stop --client antigravity'
      );
      expect(mergeAntigravityHooksJson(merged, { commandPrefix: 'node /app/dist/index.js' })).toBe(
        merged
      );
    });

    it('replaces legacy verbose AGENTS.md checklists and managed blocks while preserving user content', () => {
      const legacyDoc = `# Project Guide\n\nKeep builds green.\n\n## Autonomous Memory Checklist\n**CRITICAL FORCING FUNCTION**: bla bla\n- [ ] Old bloat\n\n## Architecture\nCustom section.\n`;
      const migrated = upsertAgentsManagedBlock(legacyDoc);
      expect(migrated).toContain('# Project Guide');
      expect(migrated).toContain('Keep builds green.');
      expect(migrated).toContain('## Architecture\nCustom section.');
      expect(migrated).not.toContain('Autonomous Memory Checklist');
      expect(migrated).toContain(MANAGED_BLOCK_START);

      // Re-running upsert on already-migrated content is strictly identical
      expect(upsertAgentsManagedBlock(migrated)).toBe(migrated);
    });

    it('merges Claude Code lifecycle hooks non-destructively alongside existing user settings', () => {
      const existing = JSON.stringify(
        {
          permissions: { allow: ['Read'] },
          hooks: {
            SessionStart: [{ hooks: [{ type: 'command', command: 'echo user-hook' }] }],
          },
        },
        null,
        2
      );
      const mergedOnce = mergeClaudeSettingsHooks(existing);
      const parsed = JSON.parse(mergedOnce);
      expect(parsed.permissions).toEqual({ allow: ['Read'] });
      expect(parsed.hooks.SessionStart).toHaveLength(2);
      expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe('echo user-hook');
      expect(parsed.hooks.SessionStart[1].hooks[0].command).toContain('hook SessionStart');

      // Re-merging is byte-identical
      expect(mergeClaudeSettingsHooks(mergedOnce)).toBe(mergedOnce);
    });

    it('parses CLI flags (--no-hooks, --agents) and respects selective init options', async () => {
      const parsed = parseInitCliArgs(['--no-hooks', '--agents=antigravity']);
      expect(parsed).toEqual({
        includeHooks: false,
        agents: ['antigravity'],
        hookCommand: undefined,
        enableAntigravityHooks: undefined,
      });

      await runInit({ cwd: tmpDir, ...parsed });
      expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
      expect(
        fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'memory-auto-capture', 'SKILL.md'))
      ).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.agents', 'hooks.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, '.claude', 'settings.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'cognitive-memory.mdc'))).toBe(
        false
      );
    });

    it('executes deterministic offline lifecycle hooks and honors Antigravity stdout JSON contract', async () => {
      process.env.EMBEDDING_PROVIDER = 'none';
      expect(normalizeLifecycleEvent('auto-dream')).toBe('AutoDream');
      expect(normalizeLifecycleEvent('pre-compact')).toBe('PreCompact');
      expect(normalizeLifecycleEvent('session-end')).toBe('Stop');
      expect(normalizeLifecycleEvent(undefined)).toBe('SessionStart');

      expect(parseHookCliArgs(['Stop', '--client', 'antigravity'])).toEqual({
        event: 'Stop',
        client: 'antigravity',
        stdoutJson: true,
        vaultPath: undefined,
      });
      expect(formatAntigravityHookOutput('SessionStart')).toEqual({});
      expect(formatAntigravityHookOutput('Stop')).toEqual({ decision: 'allow' });
      expect(shouldSkipHookForInput('Stop', { terminationReason: 'USER_CANCELED' })).toBe(true);
      expect(shouldSkipHookForInput('Stop', { terminationReason: 'NO_TOOL_CALL' })).toBe(false);

      const skipped = await runLifecycleHook('Stop', {
        client: 'antigravity',
        stdinPayload: { terminationReason: 'USER_CANCELED' },
      });
      expect(skipped.skipped).toBe(true);
      expect(skipped.consolidated).toBe(false);

      const vaultDir = path.join(tmpDir, 'vault');
      const dreamRes = await runLifecycleHook('AutoDream', { vaultPath: vaultDir });
      expect(dreamRes.event).toBe('AutoDream');
      expect(dreamRes.consolidated).toBe(true);
      expect(dreamRes.exported).toBe(true);
      expect(dreamRes.errors).toEqual([]);

      // Verify compiled CLI honors strict Antigravity stdout JSON contract with zero stray stdout bytes
      const distIndex = path.resolve(import.meta.dirname, '..', 'dist', 'index.js');
      if (fs.existsSync(distIndex)) {
        const proc = spawnSync(
          process.execPath,
          [distIndex, 'hook', 'Stop', '--client', 'antigravity', '--vault', vaultDir],
          {
            input: JSON.stringify({
              hookEventName: 'Stop',
              terminationReason: 'USER_CANCELED',
            }),
            encoding: 'utf-8',
            env: {
              ...process.env,
              MEMORY_DB_PATH: ':memory:',
              MEMORY_GLOBAL_DB_PATH: ':memory:',
              EMBEDDING_PROVIDER: 'none',
            },
            timeout: 10000,
          }
        );
        expect(proc.status).toBe(0);
        expect(JSON.parse(proc.stdout.trim())).toEqual({ decision: 'allow' });
      }
      delete process.env.EMBEDDING_PROVIDER;
    });
  });

  describe('setup.ts (multi-IDE atomic patching including Codex & Cline #134)', () => {
    it('injects MCP configuration atomically into Claude, Codex, and Cline configs in isolated temp home', async () => {
      const fakeHome = path.join(tmpDir, 'home');
      const fakeAppData = path.join(fakeHome, 'AppData', 'Roaming');
      const claudePath = path.join(fakeHome, '.claude.json');
      const codexPath = path.join(fakeHome, '.codex', 'config.toml');
      const clinePath = path.join(
        fakeAppData,
        'Code',
        'User',
        'globalStorage',
        'saoudrizwan.claude-dev',
        'settings',
        'cline_mcp_settings.json'
      );

      fs.mkdirSync(path.dirname(codexPath), { recursive: true });
      fs.mkdirSync(path.dirname(clinePath), { recursive: true });
      fs.writeFileSync(claudePath, JSON.stringify({ mcpServers: {} }), 'utf-8');
      fs.writeFileSync(codexPath, '# Codex config\nmodel = "gpt-5"\n', 'utf-8');
      fs.writeFileSync(
        clinePath,
        JSON.stringify({ mcpServers: { existing: { command: 'node' } } }),
        'utf-8'
      );

      // Dry-run reports targets without modifying files on disk
      expect(parseSetupCliArgs(['--dry-run'])).toEqual({ dryRun: true });
      const dryRes = await runSetup({
        homedir: fakeHome,
        platform: 'win32',
        appData: fakeAppData,
        dryRun: true,
      });
      expect(dryRes.configured).toEqual(expect.arrayContaining(['Claude Code', 'Codex', 'Cline']));
      expect(
        JSON.parse(fs.readFileSync(clinePath, 'utf-8')).mcpServers['cognitive-memory']
      ).toBeUndefined();

      // Live run patches all three atomically and preserves existing entries/comments
      const res = await runSetup({
        homedir: fakeHome,
        platform: 'win32',
        appData: fakeAppData,
      });
      expect(res.configured).toEqual(expect.arrayContaining(['Claude Code', 'Codex', 'Cline']));
      expect(res.errors).toEqual([]);

      const updatedClaude = JSON.parse(fs.readFileSync(claudePath, 'utf-8'));
      expect(updatedClaude.mcpServers['cognitive-memory']).toBeDefined();

      const updatedCline = JSON.parse(fs.readFileSync(clinePath, 'utf-8'));
      expect(updatedCline.mcpServers.existing).toEqual({ command: 'node' });
      expect(updatedCline.mcpServers['cognitive-memory']).toBeDefined();

      const updatedCodex = fs.readFileSync(codexPath, 'utf-8');
      expect(updatedCodex).toContain('# Codex config');
      expect(updatedCodex).toContain('[mcp_servers.cognitive-memory]');

      // Second run is strictly idempotent (zero rewrites, zero duplicates)
      const secondRes = await runSetup({
        homedir: fakeHome,
        platform: 'win32',
        appData: fakeAppData,
      });
      expect(secondRes.configured).toEqual([]);
      expect(secondRes.alreadyConfigured).toEqual(
        expect.arrayContaining(['Claude Code', 'Codex', 'Cline'])
      );
      expect(fs.readFileSync(codexPath, 'utf-8')).toBe(updatedCodex);
    });

    it('handles invalid JSON config gracefully without crashing', async () => {
      const fakeHome = path.join(tmpDir, 'home-bad');
      fs.mkdirSync(fakeHome, { recursive: true });
      fs.writeFileSync(path.join(fakeHome, '.claude.json'), 'not valid json', 'utf-8');

      const res = await runSetup({ homedir: fakeHome, platform: 'linux' });
      expect(res.errors.length).toBeGreaterThan(0);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
