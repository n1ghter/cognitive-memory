### Web Server Implementation
#### Purpose:
The `web.ts` file serves as the entry point for the web server, responsible for rendering the graph visualization and serving static files from the UI dist directory.

#### Exposed Tools/Interfaces:

* SQLite tables: `global.memory`, `main.memory`, `global.edges`, `main.edges`
* MCP tools: None explicitly listed

### Why:
This file is designed to provide a user-friendly interface for accessing the graph data, allowing users to view and interact with the visualization. It serves static files from the UI dist directory, provides a fallback for single-page applications (SPAs), and exposes an API endpoint to fetch the graph data.

### Note:
The `startWebServer` function is responsible for setting up the Express.js application, handling CORS requests, serving static files, and listening on a specified port. It also includes error handling and logging mechanisms to ensure a smooth user experience.