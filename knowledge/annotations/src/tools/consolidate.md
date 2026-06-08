```markdown
### Memory Consolidation Tool

This tool executes a memory consolidation process on the database, pruning inactive memories,
updating importance scores based on access times, and performing background deduplication to merge similar memories into a single entry.

**Interactions with:**

* `DatabaseManager` for database operations
* `OllamaClient` for text generation and embedding calculations

### Purpose:

The purpose of this tool is to maintain the memory consolidation system by periodically updating the importance scores of active records based on their access times, pruning inactive records, and merging similar memories into a single entry.
```