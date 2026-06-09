# Cognitive Memory Roadmap

This roadmap outlines the future architectural evolution of the Cognitive Memory project. While our current architecture provides unmatched **Human-Agent Cognitive Symmetry** via Obsidian integration, we acknowledge that the AI memory ecosystem is evolving rapidly. 

Below are the strategic initiatives we plan to implement, inspired by the strengths of other state-of-the-art memory platforms.

---

## 📅 Phase 1: Advanced Graph & Reasoning 
*(Inspired by Graphiti & Cognee)*

Currently, our agents must make multiple sequential MCP tool calls to traverse relationships (`memory_relate`).

- **[ ] Multi-hop Reasoning via Recursive CTEs:** Implement recursive SQL queries inside `memory_search`. Instead of returning just the immediate semantic matches, the tool will optionally return a pre-computed "sub-graph" (e.g., node A, plus all nodes connected to A up to depth 3). This will drastically reduce agent token usage and API roundtrips.
- **[ ] Temporal Knowledge Graphs (Time-Awareness):** 
  Однозначно необходимо для долгоживущих проектов. Если месяц назад мы использовали "SurrealDB", а сегодня перешли на "SQLite", простой `memory_delete` навсегда уничтожит понимание того, *почему* в старых коммитах был SurrealDB. Темпоральность решает эту проблему:
  - В таблицу `memories` добавляются колонки `valid_from` и `valid_until`.
  - При изменении факта мы не делаем `DELETE`, а ставим старому факту `valid_until = Date.now()` и создаем новую строку.
  - Наша суперсила: в **Obsidian** это будет визуализировано через YAML Frontmatter:
    ```yaml
    ---
    status: archived
    valid_until: 2026-06-08
    ---
    ```
    Человек прямо в Obsidian увидит "архивные" мысли агента. Это идеально ложится в парадигму Human-Agent Symmetry!

## 📅 Phase 2: Autonomous Context Management
*(Inspired by Letta / MemGPT)*

Currently, Cognitive Memory is "passive" (RAG). The agent must explicitly call tools to remember or search.

- **[ ] Paged Memory System:** Introduce a mechanism to track the "Context Pressure" of the active agent session.
- **[ ] Context Injection APIs:** Allow the MCP server to proactively push highly relevant "core memories" or "persona constraints" to the top of the agent's context window without the agent needing to explicitly ask for them.

## 📅 Phase 3: Background Processing & Consolidation
*(Inspired by LangMem & Hindsight)*

Критически важная фича, чтобы Obsidian не превратился в мусорку из сотен мелких обрывочных фактов (вида "Пользователь добавил функцию X").

- **[ ] Background Daemon (`npx cognitive-memory daemon`):** Наше огромное преимущество в том, что Ollama работает локально и бесплатно (в отличие от LangMem, который сжег бы сотни долларов на API OpenAI при фоновой работе). 
  - Скрипт будет запускаться в фоне при низкой загрузке CPU.
  - Он будет брать, например, 50 мелких фактов за день, отправлять их в локальную `llama3.2` с промптом *"Сделай красивую сводную статью для Obsidian"*.
  - В итоге он заменит 50 мелких файлов-заметок одним красивым документом, например, `Architecture_Updates_June.md`.
- **[ ] Auto-Pruning:** Identify and slowly decay "orphan" memories that haven't been accessed or connected to any new concepts over long periods.

## 📅 Phase 4: Non-Lossy Episodic Transcripts
*(Inspired by MemPalace)*

Currently, we rely heavily on vectorization and summarization (Semantic Memory), which can lose nuanced phrasing and verbatim context.

- **[ ] Verbatim Episodic Memory (The "Transcript Room"):** Add a dedicated storage layer for exact word-for-word session logs. If the semantic vector search fails to capture the nuance of a past architectural debate, the agent can transition into the episodic layer and "replay" the exact conversation verbatim, utilizing the "Method of Loci" retrieval pattern to prevent hallucinations.

---

## 🤝 How to Contribute
If you are interested in tackling any of these roadmap items, please check our [CONTRIBUTING.md](CONTRIBUTING.md) and open an Issue to discuss the architecture before submitting a PR!
