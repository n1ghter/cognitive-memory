### Purpose
This script is a part of an AI auto-documentation tool that utilizes the OllamaClient to generate JSDoc comments and semantic annotations for source code files.

### Interactions
- MCP tools: 
  - `git diff --cached --name-only --diff-filter=ACM`
- SQLite tables: not explicitly listed, as the script doesn't interact with them

### Semantic Summary
The purpose of this file is to ensure that source code files are annotated with JSDoc comments and semantic summaries. It achieves this by:

1.  Iterating through the list of modified `.ts` files.
2.  For each file, generating inline JSDoc comments using OllamaClient's `generateText()` function and writing it back to the original file.
3.  Next, generating a concise semantic summary (annotation) for the same file, focusing on business logic and architectural purpose.
4.  The generated annotation is then written to an annotated Markdown file within the 'knowledge' directory.

This process ensures that source code files are properly documented with both technical comments and high-level summaries.