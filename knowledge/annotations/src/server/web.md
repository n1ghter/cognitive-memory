### Semantic Summary: Web Server Startup
#### Business Logic and Architectural Purpose

The `startWebServer` function initiates the web server to serve a graphical user interface (GUI) for displaying network visualization data. It exposes a REST API endpoint `/api/graph` that fetches graph nodes and links from an underlying database using SQLite.

This setup enables a web-based frontend to display interactive visualizations, allowing users to explore complex network structures.

### Explicitly Listed MCP Tools and Interactions

*   SQLite tables (`memory`, `edges`)
*   Exposes CORS capabilities
*   Serves static files from the UI dist directory