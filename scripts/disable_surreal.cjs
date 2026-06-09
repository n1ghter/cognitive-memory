const fs = require('node:fs');
const path = 'C:\\Users\\User\\.gemini\\config\\mcp_config.json';
if (fs.existsSync(path)) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (data.mcpServers?.['surreal-memory']) {
    delete data.mcpServers['surreal-memory'];
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    console.log('Disabled surreal-memory in global config.');
  }
}
