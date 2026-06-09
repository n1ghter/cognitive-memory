const fs = require('node:fs');
const path = 'C:\\Users\\User\\.gemini\\config\\mcp_config.json';
if (fs.existsSync(path)) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));

  data.mcpServers['cognitive-memory'] = {
    command: 'C:\\Program Files\\nodejs\\node.exe',
    args: ['C:\\Users\\User\\.gemini\\antigravity\\scratch\\cognitive-memory\\dist\\index.js'],
    env: {
      MEMORY_DB_PATH: 'C:\\Users\\User\\.gemini\\cognitive_memory.sqlite',
    },
    disabled: false,
  };

  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Updated cognitive-memory env config.');
}
