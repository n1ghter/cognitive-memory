**Memory Export Test Suite**

This test suite validates the functionality of the `executeMemoryExport` tool, ensuring that it correctly exports memories to markdown files with various configurations.

The test suite covers the following scenarios:

* Exporting memories to markdown files
* Creating the export directory if it does not exist
* Including graph relations in the exported file
* Including category information in frontmatter
* Using default vaultPath if not provided
* Handling multiple edges for the same source and target to hit map caching branches
* Skipping overwrite if file on disk is newer

Note: This test suite only focuses on the business logic and architectural purpose of the `executeMemoryExport` tool, without documenting standard interfaces or parameter types.