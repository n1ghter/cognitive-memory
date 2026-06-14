**Web Server Annotation**
========================

The purpose of this file is to create an Express.js server that serves a web UI dashboard with an API endpoint for fetching graph data from the SQLite database. The server also serves static files from the UI dist directory and provides a fallback route for single-page applications (SPAs). If exposed, it interacts with the `DatabaseManager` class to retrieve graph data.

It exposes MCP tools: None.

If interacting with SQLite tables: yes