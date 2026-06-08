<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cognitive-memory** (225 symbols, 375 relationships, 16 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cognitive-memory/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cognitive-memory/clusters` | All functional areas |
| `gitnexus://repo/cognitive-memory/processes` | All execution flows |
| `gitnexus://repo/cognitive-memory/process/{name}` | Step-by-step execution trace |

<!-- gitnexus:end -->

## Changelog Automation

Every time an AI Agent completes a significant task, feature implementation, bug fix, or refactoring session in this repository, it MUST automatically update the `CHANGELOG.md` file as part of its final execution steps.
1. **Format:** Adhere strictly to the "Keep a Changelog" format (https://keepachangelog.com/).
2. **Location:** Always append new entries under the `## [Unreleased]` section header. If the header doesn't exist, create it above the latest version.
3. **Categories:** Group changes under appropriate sub-headers: `### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed`, or `### Security`.
4. **Proactivity:** Do NOT ask the user for permission to update the changelog. Just update it automatically before concluding the conversation.

## Semantic Versioning Automation

Whenever an AI Agent completes a task that warrants a changelog update, it MUST also proactively bump the project's version.
- Use `npm version patch` for bug fixes or minor refactoring.
- Use `npm version minor` for new features or significant changes that are backward-compatible.
- Use `npm version major` for breaking changes or major architectural overhauls.
- Execute this command directly in the terminal before the final response. Do NOT ask for permission to bump the version if significant changes were already approved by the user.

## AI Memory & Annotation Standards

**Rule:** When you significantly modify a core file, you are responsible for updating its semantic annotation.
- **Trigger:** Pre-commit hooks may prompt you to do this automatically.
- **Tooling:** Use the `generate_file_annotation` skill to read the file and store its summary.
- **Format:** 
  - Always use Markdown.
  - Focus purely on the "Why" (Business Logic, Architectural Purpose).
  - Do not summarize standard language syntax.
  - Keep it under 5-7 sentences if possible.
- **Project Specifics:** When annotating files in this repository, explicitly list exposed MCP Tools and SQLite Database Tables. Do NOT duplicate technical inputs/outputs; put those in JSDoc inline.

## Architectural & Engineering Principles

- **DRY (Don't Repeat Yourself):** Eliminate redundancy in both code and configuration. Standardize shared logic, patterns, and assets.
- **KISS (Keep It Simple, Stupid):** Strive for maximum simplicity. A clear, readable, and straightforward implementation is always superior to a clever, complex one.
- **YAGNI (You Aren't Gonna Need It):** Implement only the features and code required for the current task. Do not write speculative code for hypothetical future requirements.
- **Anti-BDUF (Avoid Big Design Up Front):** Favor evolutionary architecture and iterative refinement. Do not try to design the entire universe before writing code.
- **SOLID Principles:** Strictly adhere to SOLID in object-oriented and modular systems.
- **Avoid Premature Optimization:** Focus first on correctness and clean architecture. Do not optimize prematurely. Only optimize when there is an empirically measured bottleneck or when it makes direct, practical sense.
- **Occam's Razor (Бритва Оккама):** Prefer the simplest design that completely satisfies the requirements. Do not introduce unnecessary abstractions, layers, or wrappers without direct architectural necessity.

## Git Commit Standards

- **Format:** `<type>(<scope>): <description>` (e.g., `fix(tests): resolve login timeout`).
- **Allowed Types:** `feat`, `fix`, `docs`, `perf`, `refactor`, `style`, `test`, `chore`, `ci`.
