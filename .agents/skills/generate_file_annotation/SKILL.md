---
name: generate_file_annotation
description: Generates a concise semantic summary (annotation) for a given file and saves it to the local project's knowledge base or memory store.
---

# Generate File Annotation Skill

## Purpose
Use this skill when you need to create or update an AI Annotation for a specific source code file. This annotation helps the semantic index understand the high-level business purpose of the file.

## Instructions
When invoked to annotate a file, follow these exact steps:

1. **Read the File:** Use the `view_file` tool to read the contents of the target file.
2. **Analyze the Purpose:** Determine the "Why" behind this file. What business logic does it solve? What is its architectural role?
3. **Draft the Annotation (Hybrid Boundary Rule):**
   - Write a concise summary in Markdown focusing PURELY on the "Why" and architectural role.
   - **DO NOT** document standard interfaces, types, parameters, or return values. Assume those are (or should be) written as inline JSDoc/TSDoc within the source code itself.
   - Ignore standard syntax. Focus on custom logic, state management, API calls, and database interactions.
   - Adhere to any project-specific rules defined in the local `.antigravity_rules.md`.
4. **Store the Annotation:**
   - **Crucial Rule:** ALWAYS use the `write_to_file` tool to save the annotation as a Markdown file in the project's `knowledge/annotations/` directory.
   - Name the file intelligently based on the source file, preserving its nested directory structure (e.g., if annotating `src/tools/export.ts`, save it as `knowledge/annotations/src/tools/export.md`).
   - DO NOT use global MCP memory databases (like `memory_store`) for file annotations. Annotations must be version-controlled alongside the code in Git.

## Example Output Format
```markdown
# Annotation: [Filename]
**Purpose:** Handles user authentication and token refresh logic.
**Key Dependencies:** Interacts with the `users` table in SurrealDB and sets JWT cookies.
**Context:** This module is critical for the login flow and should not be modified without updating the frontend state management.
```
