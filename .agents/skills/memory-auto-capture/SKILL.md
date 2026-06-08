---
name: memory-auto-capture
description: >
  Autonomous memory management skill. Agent dynamically captures facts, preferences,
  decisions, and context using the local memory MCP tools (`cognitive-memory` using SQLite). Proactively bootstraps GitNexus AST code indexes.
  Updates and prunes stale memories. Fully offline and local-first.
---

# Global Memory Auto-Capture Skill

This skill defines **autonomous cognitive memory behavior** across all workspaces and projects. The agent manages its own long-term memory and code structural indexes without user intervention, relying on the registered `surreal-memory` MCP server tools.

---

## 1. Dynamic Cognitive Retrieval (When to Read)

Instead of blindly loading memory on session startup, you MUST dynamically trigger retrieval based on **Semantic Context Triggers** in your dialogue:
- **Uncertainty Trigger**: The user references past work, a specific naming, or a past technical decision you have no current context for (e.g., *"How did we solve X?"*).
- **Architecture Trigger**: Before proposing a database engine, package manager, library, or system architecture, query the memory to check for user preferences (e.g., preference for SQLite or pnpm).
- **Error Match Trigger**: Upon encountering a compilation, runtime, or OS-level error, query the memory to see if a similar bug was resolved in previous sessions.

**Usage (On-demand Search)**:
Call the `memory_search` MCP tool:
```json
{
  "query": "<search_query>",
  "limit": 5,
  "threshold": 0.6
}
```

---

## 2. Event-Driven Real-Time Capture (When to Write)

Do not wait for the end of the session to write memories. Capture them dynamically at **Cognitive Milestones / Decision Points**:
- **Commit Moments**: The user confirms an architecture or tech stack choice (*"Let's stick with pnpm"* or *"SurrealDB is our target"*). Relate and store immediately.
- **Eureka Moments**: A complex bug is resolved or a script syntax error is successfully bypassed.
- **Fact Discovery**: The user shares a stable personal preference, work schedule, or hardware/OS detail.

**Usage (Immediate Write)**:
Call the `memory_store` MCP tool, setting `metadata.type` appropriately (e.g., `"semantic"`, `"episodic"`, `"procedural"`):
```json
{
  "text": "<atomic_fact_to_remember>",
  "importance": 0.7,
  "metadata": {
    "category": "<category_name>",
    "type": "semantic"
  }
}
```

---

## 3. Dynamic Milestone Capture

Capture episodic memory dynamically when:
- **Task Resolution**: A specific coding task or bug-fix is completed and verified (e.g., a test passes, or a feature is successfully implemented).
- **Dialogue Transition**: The user shifts topics or introduces a new problem after completing a thread.
- **Git Commit**: Upon a successful git commit, write a concise episodic memory documenting the changes and their rationale.

**Usage (Milestone Write)**:
Call the `memory_store` MCP tool with `metadata.type = "episodic"`:
```json
{
  "text": "Task Completed: [concise technical summary of what was solved and why]",
  "importance": 0.6,
  "metadata": {
    "type": "episodic"
  }
}
```

---

## 4. Automatic Code-Level AST Bootstrapping (GitNexus)

To maintain deep code intelligence, you MUST proactively bootstrap structural AST index inside the active workspace:
- **Detection Trigger**: Upon entering any workspace, check if the local `.gitnexus` directory exists.
- **Bootstrapping Action**: If `.gitnexus` is absent, automatically initialize and analyze the workspace:
  - If a `.git` folder is present:
    ```powershell
    pnpm dlx gitnexus analyze
    ```
  - If `.git` is absent, bypass git tracking:
    ```powershell
    pnpm dlx gitnexus analyze --skip-git
    ```
- **Quiet Execution**: Perform this initialization silently in the background. Once indexed, utilize `context` and `impact` commands to assist with your coding tasks.

---

## 5. Synaptic Auto-Correction & Conflict Resolution (When to Update)

Memory is fluid. You MUST dynamically correct and prune outdated knowledge:
- **Conflict Trigger**: If retrieved memory contradicts current user instructions (e.g., memory says *Postgres* but user says *SQLite*), ask the user for confirmation: *"Previously we decided on X, are we transitioning to Y?"*
- **Update Execution**: Upon confirmation, immediately update the stale memory block by soft-deleting the old UUID and storing the new consolidated fact:
  1. Call `memory_delete` with `{ "id": "<old_uuid>", "hard": false }`
  2. Call `memory_store` with `{ "text": "<new_consolidated_fact>", "importance": 0.8, "metadata": { "type": "semantic" } }`
  3. Relate the new memory record to the soft-deleted one via graph relationships:
     Call `memory_relate` with:
     ```json
     {
       "sourceId": "<new_uuid>",
       "targetId": "<old_uuid>",
       "relationType": "superseded"
     }
     ```
- **Consolidation**: Periodically trigger the `memory_consolidate` MCP tool to run decay updates and LLM-based merges of similar memories.
- **Obsidian Sync**: Call the `memory_export` MCP tool to synchronize active memories to your local Markdown files.
