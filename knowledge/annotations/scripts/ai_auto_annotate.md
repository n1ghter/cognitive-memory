```markdown
### AI Auto-Annotator Script

This script utilizes an LLaMA model to extract code snippets and generate concise semantic summaries (annotations) for business logic explanations.
 
The script runs the following steps:

- Extracts `.ts` files from a Git repository that have not been annotated yet.
- Runs the LLaMA model to generate inline JSDoc comments.
- Generates semantic annotations for each file based on the "Why" (Business Logic, Architectural Purpose).
If the generated files expose MCP tools or interact with SQLite tables, they are listed explicitly.

Note: This script is designed to be part of an automated documentation pipeline.