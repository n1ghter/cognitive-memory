### Semantic Summary
#### Business Logic: 
This file defines the business logic for an autonomous cognitive memory behavior across all workspaces and projects. It manages long-term memory without user intervention, relying on registered MCP server tools (`cognitive-memory` using SQLite).

#### Architectural Purpose:
- Exposes the `memory_search`, `memory_store`, and `memory_auto-capture` MCP tool interfaces.
- Interacts with the `.agents/skills/memory-auto-capture/SKILL.md` file.
- Updates the `AGENTS.md` file.