# 2026 Research Foundation & Strategic Pivot

> **Last updated:** November 2026  
> **Purpose:** Document the empirical studies and ecosystem shifts that drove `cognitive-memory`'s pivot from a vector+Ollama-first SQLite store (v1.x) to a **cross-tool, Markdown-first, zero-Ollama hybrid memory engine** (v2.0).

---

## 1. Why v1.x Hit a Wall

In v1.x (June 2026), `cognitive-memory` made four core assumptions:
1. **Dense vector search via local Ollama (`qwen3-embedding:8b`)** should be the mandatory primary retrieval path.
2. **SQLite** should be the primary source of truth, with Obsidian Markdown as an optional export.
3. **Forcing-function checklists in `AGENTS.md`** (`cognitive-memory init`) would compel agents to reliably search and store memories.
4. **A 3D Force Graph Web UI** would be a primary value driver.

By late 2026, both real-world usage and peer-reviewed empirical research exposed severe flaws in all four assumptions.

---

## 2. Empirical Findings (2026 Literature)

### A. Lexical Search (`grep` / BM25) vs. Dense Embeddings
- **Is Grep All You Need? How Agent Harnesses Reshape Agentic Search** (`arXiv:2605.15184`, May 2026)  
  Evaluated lexical `grep` vs. dense vector retrieval directly on a subset of **LongMemEval** across Claude Code, Codex CLI, and Gemini CLI. Under realistic distractor noise, **lexical search frequently outperformed vector retrieval**, and overall accuracy was governed primarily by the agent harness rather than the embedding model.
- **Embeddings vs. Grep: Rethinking the Dense Advantage in Code Search** (Xue et al., `arXiv:2611.20455`, Nov 2026)  
  Introduced the Repo-Premium benchmark (91 repositories, 6 languages, PRs through 2026) and demonstrated that the historical "dense advantage" was largely an artifact of handicapped lexical baselines and vocabulary mismatch. Query expansion (*generate-then-grep*) allowed BM25/lexical retrieval to match dense encoders — **while hybrid fusion (BM25 + dense embeddings) consistently outperformed either method alone**.
- **CodeGrep & Code-Graph Token Studies** (Aug 2026)  
  Showed that while bare `grep` is accurate, blind `grep → read` loops burn hundreds of thousands of exploration tokens; bounded **1–2 hop structural graph traversal** cuts relational query token cost by 75–82% (whereas unconstrained 3+ hop walks backfire with noise).

**Architectural decision:** Make **SQLite FTS5 (BM25)** the default, zero-dependency retrieval engine so `cognitive-memory` works out of the box even when Ollama is stopped. Automatically fuse **BM25 + optional dense vectors via Reciprocal Rank Fusion (RRF)** whenever an embedder is configured. Keep graph expansion capped at 1–2 hops.

---

### B. The "Memory Tax" & Lossy Distillation
- **MemoryTax: The Bitter Lesson of Agent Memory** (Peng, `arXiv:2610.29823`, Oct 2026)  
- **Memory Tax: Dissecting the Net Value of Agent Memory** (He et al., `arXiv:2610.34073`, Oct 2026)  

Both studies show that pre-digested memory pipelines (extract → summarize → embed → discard raw context) frequently incur a **negative net value**:
- Lossy summarization drops over one-third of concrete facts.
- Pure vector stores fail the **contradiction test**: an outdated fact ("we use SurrealDB") and its replacement ("we migrated to SQLite") both score high cosine similarity, causing confident hallucinations.
- Dedicated memory layers only beat raw retrieval when they preserve a **direct fallback path back to canonical raw source data** and track temporal supersession.

**Architectural decision:** Flip the storage pyramid. **Human-readable Markdown (+ Git) becomes the canonical Source of Truth**, with zero-copy `ref` pointers (`vault_path`, `wikilink`, `source_hash`, `section`) and explicit temporal supersession (`valid_from`, `valid_until`, `superseded_by`). SQLite becomes a **disposable, rebuildable hybrid index** (`cognitive-memory reindex`).

---

### C. `AGENTS.md` Bloat & Weak Conditional Compliance
- **Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?** (Gloaguen et al., ETH Zurich / LogicStar.ai, `arXiv:2602.11988`, Feb 2026) — Bloated or auto-generated `AGENTS.md` files *reduced* task success by ~3% and increased inference cost by >20% due to overly obedient over-exploration.
- **Configuration Smells in AGENTS.md Files** (Santos et al., `arXiv:2606.15828`, Jun 2026) — Cataloged widespread lint leakage (62%), context bloat (42%), and conflicting instructions.
- **Do Coding Agents Follow AGENTS.md? The Effect of Policy Wording on Instruction Compliance** (Tsuchida et al., NAIST, `arXiv:2611.04367`, Nov 2026) — Conditional triggers ("when X happens, remember to call Y") suffer the lowest compliance across model-harness pairings.

**Architectural decision:** Strip `AGENTS.md` and `cognitive-memory init` templates to minimal, prescriptive, non-redundant essentials. Move automatic capture, recall, and background consolidation into **deterministic harness lifecycle hooks** and non-LLM/optional-LLM background passes.

---

### D. Market Commoditization vs. The Remaining Unsolved Niche
By late 2026, single-tool memory became built-in:
- **Claude Code** ships native Auto Memory (`MEMORY.md`) + Auto Dream background consolidation.
- **Letta** pivoted to **Context Repositories / MemFS** (git-backed local Markdown folders navigated with `grep`/`find`).
- **Cursor** and **Windsurf** ship editor-native memories and rules.

**What remains unsolved:** Every native memory system is **locked inside its own vendor silo**. A developer switching between Claude Code, Cursor, Antigravity, Windsurf, Codex, and Cline loses continuity every time they change tools.

**`cognitive-memory`'s core positioning for 2026–2027:**
> A **vendor-neutral, cross-tool, Markdown-first, zero-Ollama hybrid memory layer** shared seamlessly across all local AI coding tools, verified continuously by an open retrieval eval harness.

---

## 3. Continuous Harness Engineering Principle

Following 2026 Harness Engineering practices (`Agent = Model + Harness`), every retrieval, storage, or consolidation change in this repository must be **measured quantitatively** in `evals/`:
- No architectural change ships on intuition alone.
- Every real retrieval failure or contradiction bug observed in daily multi-IDE usage is added permanently to `evals/dataset.json` as a regression case.
- CI gates every PR on Biome, TypeScript, unit/integration coverage, UI checks, and deterministic offline eval floors.
