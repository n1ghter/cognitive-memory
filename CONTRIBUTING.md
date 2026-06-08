# Contributing to Cognitive Memory MCP

We welcome contributions! Please follow these steps to get your development environment set up properly.

## Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/cognitive-memory.git
   cd cognitive-memory
   ```

2. **Install Dependencies:**
   We use `pnpm` as our package manager.
   ```bash
   pnpm install
   ```

3. **Rebuild Native Dependencies (Crucial):**
   Because this project uses `better-sqlite3` and `sqlite-vec`, which require native C++ compilation, and because we restrict build scripts for security, you **must** run:
   ```bash
   pnpm rebuild
   ```
   This ensures the SQLite binaries are correctly compiled for your OS.

4. **Build the Project:**
   ```bash
   pnpm run build
   ```

## Testing

We use `vitest` with mocked LLM models so you do not need Ollama running to execute tests:
```bash
pnpm test
```

## Running Locally

To run the server locally during development:
```bash
pnpm run dev
```

## Pull Request Guidelines

- Ensure `pnpm test` passes.
- Follow our conventional commits standard (`feat: ...`, `fix: ...`).
- Our Git hooks will automatically run `gitnexus` to update the code intelligence graphs.

Thank you for contributing!
