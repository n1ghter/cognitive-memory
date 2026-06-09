# Cognitive Memory Roadmap

This roadmap outlines the future architectural evolution of the Cognitive Memory project. While our current architecture provides unmatched **Human-Agent Cognitive Symmetry** via Obsidian integration, we acknowledge that the AI memory ecosystem is evolving rapidly. 

Below are the strategic initiatives we plan to implement, inspired by the strengths of other state-of-the-art memory platforms.

---

## 📅 Phase 1: Advanced Graph & Reasoning 
*(Inspired by Graphiti & Cognee)*

Currently, our agents must make multiple sequential MCP tool calls to traverse relationships (`memory_relate`).

- **[ ] Multi-hop Reasoning via Recursive CTEs:** Implement recursive SQL queries inside `memory_search`. Instead of returning just the immediate semantic matches, the tool will optionally return a pre-computed "sub-graph" (e.g., node A, plus all nodes connected to A up to depth 3). This will drastically reduce agent token usage and API roundtrips.
- **[ ] Temporal Knowledge Graphs (Time-Awareness):** 
  Absolutely essential for long-lived projects. If we used "SurrealDB" a month ago, but switched to "SQLite" today, a simple `memory_delete` would permanently destroy the understanding of *why* SurrealDB was in older commits. Temporality solves this problem:
  - Columns `valid_from` and `valid_until` are added to the `memories` table.
  - When modifying a fact, we don't `DELETE` it; we set the old fact's `valid_until = Date.now()` and create a new row.
  - Our superpower: in **Obsidian** this will be visualized via YAML Frontmatter:
    ```yaml
    ---
    status: archived
    valid_until: 2026-06-08
    ---
    ```
    A human will directly see the agent's "archived" thoughts in Obsidian. This perfectly aligns with the Human-Agent Symmetry paradigm!

- **[ ] Knowledge Domains (Namespaces):** 
  To support distinct contexts (e.g., `Work`, `Personal`, `Project_A`), memories will be partitioned using logical namespaces.
  - Adding a `domain` column to the `memories` table for efficient pre-filtering during `sqlite-vec` vector searches (`WHERE domain = 'xyz'`).
  - In Obsidian, this maps perfectly to root-level folders (`/Work`, `/Personal`), allowing seamless domain segregation without needing multiple databases like Qdrant would require.

- **[ ] Knowledge Domains (Namespaces):** 
  To support distinct contexts (e.g., `Work`, `Personal`, `Project_A`), memories will be partitioned using logical namespaces.
  - Adding a `domain` column to the `memories` table for efficient pre-filtering during `sqlite-vec` vector searches (`WHERE domain = 'xyz'`).
  - In Obsidian, this maps perfectly to root-level folders (`/Work`, `/Personal`), allowing seamless domain segregation without needing multiple databases like Qdrant would require.

- **[ ] Knowledge Domains (Namespaces):** 
  To support distinct contexts (e.g., `Work`, `Personal`, `Project_A`), memories will be partitioned using logical namespaces.
  - Adding a `domain` column to the `memories` table for efficient pre-filtering during `sqlite-vec` vector searches (`WHERE domain = 'xyz'`).
  - In Obsidian, this maps perfectly to root-level folders (`/Work`, `/Personal`), allowing seamless domain segregation without needing multiple databases like Qdrant would require.

## 📅 Phase 2: Autonomous Context Management
*(Inspired by Letta / MemGPT)*

Currently, Cognitive Memory is "passive" (RAG). The agent must explicitly call tools to remember or search.

- **[ ] Paged Memory System:** Introduce a mechanism to track the "Context Pressure" of the active agent session.
- **[ ] Context Injection APIs:** Allow the MCP server to proactively push highly relevant "core memories" or "persona constraints" to the top of the agent's context window without the agent needing to explicitly ask for them.

## 📅 Phase 3: Background Processing & Consolidation
*(Inspired by LangMem & Hindsight)*

A critically important feature to prevent Obsidian from turning into a dump of hundreds of small, fragmented facts (like "User added function X").

- **[ ] Background Daemon (`npx cognitive-memory daemon`):** Our huge advantage is that Ollama runs locally and for free (unlike LangMem, which would burn hundreds of dollars on the OpenAI API for background work). 
  - The script will run in the background during low CPU usage.
  - It will take, for example, 50 small facts per day, send them to the local `llama3.2` with the prompt *"Create a beautiful summary article for Obsidian"*.
  - Ultimately, it will replace 50 small note files with one beautiful document, for example, `Architecture_Updates_June.md`.
- **[ ] Auto-Pruning:** Identify and slowly decay "orphan" memories that haven't been accessed or connected to any new concepts over long periods.

## 📅 Phase 4: Non-Lossy Episodic Transcripts
*(Inspired by MemPalace)*

Currently, we rely heavily on vectorization and summarization (Semantic Memory), which can lose nuanced phrasing and verbatim context.

- **[ ] Verbatim Episodic Memory (The "Transcript Room"):** Add a dedicated storage layer for exact word-for-word session logs. If the semantic vector search fails to capture the nuance of a past architectural debate, the agent can transition into the episodic layer and "replay" the exact conversation verbatim, utilizing the "Method of Loci" retrieval pattern to prevent hallucinations.

---

## 🤝 How to Contribute
If you are interested in tackling any of these roadmap items, please check our [CONTRIBUTING.md](CONTRIBUTING.md) and open an Issue to discuss the architecture before submitting a PR!
