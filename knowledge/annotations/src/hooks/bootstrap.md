```markdown
# Bootstrap Hooks

This script runs the necessary hooks for memory export and consolidation, 
triggered by specific events. It interacts with the SQLite database.

- Executes memory export tool (`executeMemoryExport`) when `SessionStart` or `Stop` events occur.
- Executes memory consolidation tool (`executeMemoryConsolidate`) when `PreCompact` or `Stop` events occur.
```