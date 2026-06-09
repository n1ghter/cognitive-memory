const fs = require('node:fs');
const path = 'C:\\Users\\User\\.gemini\\config\\mcp_config.json';
if (fs.existsSync(path)) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!data.mcpServers) data.mcpServers = {};

  data.mcpServers['cognitive-memory'] = {
    command: 'C:\\Program Files\\nodejs\\node.exe',
    args: ['C:\\Users\\User\\.gemini\\antigravity\\scratch\\cognitive-memory\\dist\\index.js'],
    disabled: false,
  };

  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Added cognitive-memory to global config.');
}
