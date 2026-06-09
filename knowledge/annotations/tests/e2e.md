**End-to-End Testing for Store and Search Functionality**
===========================================================

This file runs end-to-end (E2E) tests to validate the store and search functionality of the application. It checks the success of storing, searching, relating, and deleting records in a simulated database environment.

The test suite uses the `DatabaseManager` class to interact with the SQLite database (`mcp`) and executes several tools:

*   `executeMemoryStore` for storing records
*   `executeMemorySearch` for searching records
*   `executeMemoryRelate` for relating records through a graph (utilizing `graph.js`)
*   `executeMemoryDelete` for deleting records

The test ensures that each step is executed successfully and logs the results to the console.