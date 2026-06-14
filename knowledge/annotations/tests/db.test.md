**DatabaseManager Tests**
========================

This file contains tests for the DatabaseManager class and its utility functions. The purpose of these tests is to ensure that the database can be initialized, record IDs are normalized correctly, and UUIDs are generated.

Tests cover:

*   Generation of valid UUIDs
*   Normalization of record IDs
*   Initialization of in-memory database
*   Fallback to string representation for non-integer types
*   Use of MEMORY_DB_PATH environment variable to set custom database path
*   Creation of GLOBAL_DB_DIR if it does not exist

Note: These tests use the `vitest` testing framework and interact with SQLite tables, specifically `memory` table.