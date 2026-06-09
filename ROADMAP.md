# Cognitive Memory Roadmap

This roadmap outlines the future architectural evolution of the Cognitive Memory project. While our current architecture provides unmatched **Human-Agent Cognitive Symmetry** via Obsidian integration, we acknowledge that the AI memory ecosystem is evolving rapidly. 

Below are the strategic initiatives we plan to implement, inspired by the strengths of other state-of-the-art memory platforms.

---

## 📅 Phase 1: Advanced Graph & Reasoning 
*(Inspired by Graphiti & Cognee)*

Currently, our agents must make multiple sequential MCP tool calls to traverse relationships (`memory_relate`).

- **[ ] Multi-hop Reasoning via Recursive CTEs:** Implement recursive SQL queries inside `memory_search`. Instead of returning just the immediate semantic matches, the tool will optionally return a pre-computed "sub-graph" (e.g., node A, plus all nodes connected to A up to depth 3). This will drastically reduce agent token usage and API roundtrips.
- **[ ] Temporal Knowledge Graphs (Time-Awareness):** Add `valid_from` and `valid_to` timestamps to memory nodes. This allows the system to differentiate between *Event Time* (when a fact was true) and *Ingestion Time* (when the agent learned it). Instead of manually deleting old facts, they will naturally decay or be archived, allowing the agent to reconstruct historical states (e.g., "What was the architecture before the refactoring in May?").

## 📅 Phase 2: Autonomous Context Management
*(Inspired by Letta / MemGPT)*

Currently, Cognitive Memory is "passive" (RAG). The agent must explicitly call tools to remember or search.

- **[ ] Paged Memory System:** Introduce a mechanism to track the "Context Pressure" of the active agent session.
- **[ ] Context Injection APIs:** Allow the MCP server to proactively push highly relevant "core memories" or "persona constraints" to the top of the agent's context window without the agent needing to explicitly ask for them.

## 📅 Phase 3: Background Processing & Consolidation
*(Inspired by LangMem & Hindsight)*

Currently, memory consolidation requires the agent to explicitly call `memory_consolidate`.

- **[ ] Background Daemon (`npx cognitive-memory daemon`):** Introduce an optional local background worker. When the user is away, this daemon will use the local Ollama instance to silently read the Obsidian vault, deduplicate overlapping facts, detect contradictions, and synthesize higher-level "Mental Models".
- **[ ] Auto-Pruning:** Identify and slowly decay "orphan" memories that haven't been accessed or connected to any new concepts over long periods.

## 📅 Phase 4: Non-Lossy Episodic Transcripts
*(Inspired by MemPalace)*

Currently, we rely heavily on vectorization and summarization (Semantic Memory), which can lose nuanced phrasing and verbatim context.

- **[ ] Verbatim Episodic Memory (The "Transcript Room"):** Add a dedicated storage layer for exact word-for-word session logs. If the semantic vector search fails to capture the nuance of a past architectural debate, the agent can transition into the episodic layer and "replay" the exact conversation verbatim, utilizing the "Method of Loci" retrieval pattern to prevent hallucinations.

---

## 🤝 How to Contribute
If you are interested in tackling any of these roadmap items, please check our [CONTRIBUTING.md](CONTRIBUTING.md) and open an Issue to discuss the architecture before submitting a PR!
