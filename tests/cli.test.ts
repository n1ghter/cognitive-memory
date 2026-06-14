import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from '../src/cli/init.js';
import { runSetup } from '../src/cli/setup.js';

vi.mock('node:fs');

describe('CLI Scripts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init.ts', () => {
    it('should create skill and AGENTS.md if they do not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('');

      await runInit();

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // One for SKILL.md, one for AGENTS.md
    });

    it('should not overwrite if they already exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('Autonomous Memory Checklist');

      await runInit();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('setup.ts', () => {
    it('should inject MCP configuration if config exists and missing server', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ mcpServers: {} }));

      await runSetup();

      // For 4 different configs (claude, cursor, antigravity, windsurf),
      // it should write out the config if it exists.
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle invalid JSON config gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      await runSetup();

      expect(console.error).toHaveBeenCalled();
    });

    it('should not inject if already exists', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return path.includes('.claude.json'); // only return true for one specific target
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          mcpServers: {
            'cognitive-memory': {},
          },
        })
      );

      await runSetup();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should inject into TOML format', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => path.includes('config.toml'));
      vi.mocked(fs.readFileSync).mockReturnValue('');

      await runSetup();

      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it('should not inject into TOML if already exists', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => path.includes('config.toml'));
      vi.mocked(fs.readFileSync).mockReturnValue('[mcp_servers.cognitive-memory]\n');

      await runSetup();

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('should handle empty JSON file correctly', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => path.includes('.claude.json'));
      vi.mocked(fs.readFileSync).mockReturnValue('');

      await runSetup();

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});
