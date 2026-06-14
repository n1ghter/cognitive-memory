# Annotation: src/cli/init.ts
**Purpose:** Serves as the initialization routine (`cognitive-memory init`) to bootstrap autonomous memory capabilities in user repositories.
**Key Dependencies:** Uses Node.js `fs` and `path` to manipulate the local file system.
**Context:** When users install the NPM package, this script provisions the necessary Agent rules (`AGENTS.md`) and the memory-auto-capture `SKILL.md` directly into their workspace, enabling zero-config integration for local AI assistants like Antigravity or Cursor.