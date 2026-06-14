### MCP Setup Script
#### Business Logic and Architectural Purpose

This script runs a setup process for a Cognitive Memory Platform (MCP) tool. It scans installed AI agents and IDEs, detects if any MCP servers are already configured in the target locations, and injects the `@cemised/cognitive-memory` server into their configurations.

### MCP Tools Used
- MCP (Cognitive Memory Platform)
- SQLite

The script targets four platforms: Antigravity, Cursor, Claude Desktop, and Windsurf.