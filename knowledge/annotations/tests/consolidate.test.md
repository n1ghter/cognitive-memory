```markdown
# Memory Consolidation Tool Tests

This file contains unit tests for the memory consolidation tool, which is responsible for deduplicating and pruning memories in the system.

## Purpose

The purpose of this test suite is to ensure that the memory consolidation tool functions correctly under various scenarios, including:

* Deduplication with less than 3 memories
* Consolidation of active memories
* Pruning of old memories whose importance decays below 0.25
* Handling errors during generation

## Tools and Interactions

This file interacts with the SQLite database using the `DatabaseManager` class.
```