import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MCP_SERVER_NAME = 'cognitive-memory';
const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['-y', '@cemised/cognitive-memory'],
};

interface ConfigTarget {
  name: string;
  paths: string[];
  format?: 'json' | 'toml';
  rootKey?: string;
}

export interface SetupOptions {
  homedir?: string;
  platform?: NodeJS.Platform;
  appData?: string;
  dryRun?: boolean;
}

export interface SetupResult {
  configured: string[];
  alreadyConfigured: string[];
  skipped: string[];
  errors: string[];
  dryRun: boolean;
}

/**
 * Writes a file atomically (temp file in same directory + rename) so IDE config files
 * can never be truncated or corrupted on crash.
 */
function writeFileAtomic(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Builds the deterministic list of supported IDE / AI coding agent MCP configuration targets.
 */
export function getSetupTargets(options: SetupOptions = {}): ConfigTarget[] {
  const homedir = options.homedir ?? os.homedir();
  const platform = options.platform ?? os.platform();
  const appData =
    options.appData ??
    (platform === 'win32'
      ? process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming')
      : platform === 'darwin'
        ? path.join(homedir, 'Library', 'Application Support')
        : path.join(homedir, '.config'));

  return [
    {
      name: 'Claude Desktop',
      paths: [path.join(appData, 'Claude', 'claude_desktop_config.json')],
    },
    {
      name: 'Claude Code',
      paths: [path.join(homedir, '.claude.json')],
    },
    {
      name: 'Antigravity',
      paths: [path.join(homedir, '.gemini', 'config', 'mcp_config.json')],
    },
    {
      name: 'Cursor',
      paths: [
        path.join(homedir, '.cursor', 'mcp.json'),
        path.join(appData, 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json'),
      ],
    },
    {
      name: 'Copilot CLI',
      paths: [path.join(homedir, '.copilot', 'mcp-config.json')],
    },
    {
      name: 'Windsurf',
      paths: [path.join(homedir, '.codeium', 'windsurf', 'mcp_config.json')],
    },
    {
      name: 'OpenCode',
      paths: [path.join(homedir, '.opencode', 'opencode.json')],
      rootKey: 'mcp',
    },
    {
      name: 'Codex',
      paths: [path.join(homedir, '.codex', 'config.toml')],
      format: 'toml',
    },
    {
      name: 'Cline',
      paths: [
        path.join(
          appData,
          'Code',
          'User',
          'globalStorage',
          'saoudrizwan.claude-dev',
          'settings',
          'cline_mcp_settings.json'
        ),
        path.join(homedir, '.cline', 'mcp_settings.json'),
      ],
    },
  ];
}

export function parseSetupCliArgs(argv: string[]): SetupOptions {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

/**
 * Deterministically scans for installed AI agents/IDEs and injects `cognitive-memory`
 * using atomic file replacement without disturbing user comments or unrelated servers.
 */
export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const dryRun = Boolean(options.dryRun);
  const targets = getSetupTargets(options);
  const result: SetupResult = {
    configured: [],
    alreadyConfigured: [],
    skipped: [],
    errors: [],
    dryRun,
  };

  console.error('Scanning for installed AI agents and IDEs...');

  for (const target of targets) {
    let found = false;
    const format = target.format || 'json';
    const rootKey = target.rootKey || 'mcpServers';

    for (const configPath of target.paths) {
      if (!fs.existsSync(configPath)) continue;
      found = true;

      try {
        const content = fs.readFileSync(configPath, 'utf-8');

        if (format === 'json') {
          const json = JSON.parse(content || '{}');
          if (!json[rootKey] || typeof json[rootKey] !== 'object') {
            json[rootKey] = {};
          }

          if (json[rootKey][MCP_SERVER_NAME]) {
            console.error(
              `[${target.name}] cognitive-memory is already configured at ${configPath}`
            );
            result.alreadyConfigured.push(target.name);
          } else {
            json[rootKey][MCP_SERVER_NAME] = MCP_SERVER_CONFIG;
            if (!dryRun) {
              writeFileAtomic(configPath, `${JSON.stringify(json, null, 2)}\n`);
            }
            console.error(
              `[${target.name}] ${dryRun ? 'Would inject' : 'Injected'} cognitive-memory into ${configPath}`
            );
            result.configured.push(target.name);
          }
        } else if (format === 'toml') {
          const hasSection =
            content.includes(`[mcp_servers.${MCP_SERVER_NAME}]`) ||
            content.includes(`[mcp_servers."${MCP_SERVER_NAME}"]`);

          if (hasSection) {
            console.error(
              `[${target.name}] cognitive-memory is already configured at ${configPath}`
            );
            result.alreadyConfigured.push(target.name);
          } else {
            const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
            const tomlBlock = `${prefix}\n[mcp_servers.${MCP_SERVER_NAME}]\ncommand = "npx"\nargs = ["-y", "@cemised/cognitive-memory"]\n`;
            if (!dryRun) {
              writeFileAtomic(configPath, `${content}${tomlBlock}`);
            }
            console.error(
              `[${target.name}] ${dryRun ? 'Would append' : 'Appended'} cognitive-memory to ${configPath}`
            );
            result.configured.push(target.name);
          }
        }
      } catch (err: any) {
        const msg = `[${target.name}] Failed to parse or write ${configPath}: ${err.message}`;
        console.error(msg);
        result.errors.push(msg);
      }
      break;
    }

    if (!found) {
      result.skipped.push(target.name);
    }
  }

  console.error(
    `Global MCP Setup complete: ${result.configured.length} configured, ${result.alreadyConfigured.length} already configured, ${result.skipped.length} not found.`
  );
  return result;
}
