```markdown
# Memory Consolidation Tool

This file implements the memory consolidation tool, which prunes inactive memories,
updates importance scores based on access times, and performs background deduplication.
to merge similar memories into a single entry.

## Database Interactions

- `executeMemoryConsolidate`: Retrieves active records from SQLite database using SQL queries.
- `runBackgroundDeduplication`: Retrieves active records from SQLite database and calculates similarity scores between the current memory and other similar records. It then updates related records to reflect the consolidation process.
```