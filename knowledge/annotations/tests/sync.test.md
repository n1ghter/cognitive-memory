### Semantic Summary
#### Why

This file contains unit tests for the Memory Sync feature in Obsidian. The purpose of these tests is to verify that:

*   Memories are synced bidirectionally between Obsidian and the database.
*   Agent deletions are propagated to disk.
*   User deletions are propagated from disk to SQLite.

The tests ensure that the memory sync functionality works correctly, handling different scenarios such as syncing memories, deleting agents and users, and updating database records.