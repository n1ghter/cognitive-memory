import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MCP_SERVER_NAME = 'cognitive-memory';
const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['-y', '@cemised/cognitive-memory']
};

interface ConfigTarget {
  name: string;
  paths: string[];
}

export async function runSetup() {
  console.log('Scanning for installed AI agents and IDEs...');

  const homedir = os.homedir();
  const platform = os.platform();
  const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');

  const targets: ConfigTarget[] = [
    {
      name: 'Antigravity',
      paths: [path.join(homedir, '.gemini', 'config', 'mcp_config.json')]
    },
    {
      name: 'Cursor',
      paths: [
        path.join(homedir, '.cursor', 'mcp.json'),
        platform === 'win32'
          ? path.join(appData, 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json')
          : path.join(homedir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json')
      ]
    },
    {
      name: 'Claude Desktop',
      paths: [
        platform === 'win32'
          ? path.join(appData, 'Claude', 'claude_desktop_config.json')
          : path.join(homedir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      ]
    },
    {
      name: 'Windsurf',
      paths: [path.join(homedir, '.codeium', 'windsurf', 'mcp_config.json')]
    }
  ];

  let configuredCount = 0;

  for (const target of targets) {
    let found = false;
    for (const configPath of target.paths) {
      if (fs.existsSync(configPath)) {
        found = true;
        try {
          const content = fs.readFileSync(configPath, 'utf-8');
          let json = JSON.parse(content || '{}');

          if (!json.mcpServers) {
            json.mcpServers = {};
          }

          if (json.mcpServers[MCP_SERVER_NAME]) {
            console.log(`ℹ️ [${target.name}] cognitive-memory is already configured at ${configPath}`);
          } else {
            json.mcpServers[MCP_SERVER_NAME] = MCP_SERVER_CONFIG;
            fs.writeFileSync(configPath, JSON.stringify(json, null, 2), 'utf-8');
            console.log(`✅ [${target.name}] Successfully injected cognitive-memory into ${configPath}`);
            configuredCount++;
          }
        } catch (err: any) {
          console.error(`❌ [${target.name}] Failed to parse or write to ${configPath}: ${err.message}`);
        }
        break; // Stop checking alternative paths for this target if we found one
      }
    }
    
    if (!found) {
      console.log(`⏭️ [${target.name}] Config file not found, skipping.`);
    }
  }

  console.log('\n🚀 Global MCP Setup Complete!');
  if (configuredCount > 0) {
    console.log(`Successfully configured ${configuredCount} editor(s). Please restart them to apply the changes.`);
  } else {
    console.log('No new configurations were applied.');
  }
}
