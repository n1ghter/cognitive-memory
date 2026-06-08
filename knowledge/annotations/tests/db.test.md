```markdown
# Testing Database Manager and Utilities

This file tests the functionality of `DatabaseManager` and its associated utility functions. It verifies that UUIDs are generated correctly, record IDs are normalized properly, and the in-memory database is initialized successfully.

## Tested Functions

* `generateId()`: generates valid UUIDs
* `normalizeRecordId()`: normalizes record IDs
* `DatabaseManager.getInstance()`: initializes the in-memory database

## Tests Covered

- Generation of valid UUIDs
- Normalization of record IDs
- Initialization of in-memory database and verification of table existence
```