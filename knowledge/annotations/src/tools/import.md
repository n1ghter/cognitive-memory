**Semantic Summary**
====================
### Purpose

This file provides an implementation of memory import functionality using the `MCP tools` and interacting with SQLite tables.

It fetches memory files from a specified directory, extracts relevant information, and updates the corresponding database records. If necessary, it inserts new records into the database.

The imported data includes the `imported_files`, `total_imported`, and any encountered errors.

### Architectural Purpose

This file is responsible for executing the memory import process, which involves:

*   Fetching files from a specified directory
*   Parsing markdown files to extract relevant information (e.g., text, metadata, importance)
*   Updating or inserting records into the database based on the extracted data
*   Handling errors during processing

The file uses `MCP tools` for tasks like reading directories and accessing SQLite tables.

### Data Flow

The file takes input from a directory containing memory files. The process involves:

1.  Reading the directory to fetch relevant files.
2.  Parsing each file's content to extract data (e.g., text, metadata, importance).
3.  Updating or inserting records into the database based on the extracted data.
4.  Handling errors during processing.

The output includes the `imported_files`, `total_imported`, and any encountered errors.

### Database Interaction

This file interacts with SQLite tables using the `DatabaseManager` instance, which provides methods for executing queries, handling transactions, and accessing tables.