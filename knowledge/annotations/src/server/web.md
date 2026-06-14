```markdown
### Web Server Start Functionality

This file exports a function `startWebServer` that starts an Express.js web server, responsible for serving the UI dashboard and providing graph data through API endpoints. It interacts with SQLite tables via the `DatabaseManager` instance.

- Exposes API endpoint '/api/graph' to fetch graph data.
- Serves static files from the UI dist directory.
```