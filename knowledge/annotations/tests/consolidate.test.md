```markdown
# Consolidate Tool Test Suite

This test suite ensures the proper functioning of the `executeMemoryConsolidate` tool, which consolidates duplicate memories in the system.

The consolidation process is triggered when at least three active memories exist with overlapping text. This process updates the database to remove duplicates and marks them as consolidated.

The tool interacts with the SQLite table "memory" and uses the OllamaClient mock.
```