# ADR 0001: Markdown-First Canonical Store & Zero-Ollama Hybrid Retrieval

- **Status:** Accepted
- **Date:** 2026-11-25
- **Related:** [docs/RESEARCH_2026.md](../RESEARCH_2026.md), [docs/ARCHITECTURE_V2.md](../ARCHITECTURE_V2.md), Issues `#129`, `#130`, `#131`

## Context

Early versions (`v1.x`) treated SQLite + mandatory local Ollama embeddings (`qwen3-embedding:8b`) as the primary memory store. Empirical 2026 research and real-world usage exposed three structural flaws:

1. **Fragile runtime dependency:** Requiring a running Ollama daemon caused cold-start friction, silent failures when Ollama was stopped, and high adoption barriers across machines.
2. **Pure-vector failure modes:** Benchmarks (`arXiv:2605.15184`, `arXiv:2611.20455`) demonstrated that dense embeddings degrade on exact identifiers, error codes, and high-noise corpora, while **Hybrid (BM25 + dense vectors)** consistently outperforms both pure lexical search and pure embeddings.
3. **Memory Tax (`arXiv:2610.29823`, `arXiv:2610.34073`):** Treating an opaque vector database as the sole source of truth introduces irreversible lossy distillation unless backed by human-inspectable raw files and zero-copy references.

## Decision

1. **Invert the storage hierarchy:** Markdown (+ Git / Obsidian frontmatter) is the canonical, human-editable, `grep`-compatible source of truth. SQLite (`memory.sqlite`) is a disposable, rebuildable index reconstructed losslessly via `memory_reindex` / `cognitive-memory reindex`.
2. **Zero-Ollama default retrieval:** Maintain always-on SQLite `FTS5` (`unicode61`, Okapi BM25) tables and sync triggers across both `main` and `global` schemas. `memory_store` and `memory_search` must succeed completely offline (`EMBEDDING_PROVIDER=none` or automatic fallback when Ollama is unreachable).
3. **Optional Hybrid RRF acceleration:** When an embedding provider is available, fuse BM25 and `sqlite-vec` cosine candidates via Reciprocal Rank Fusion (RRF), exposing `mode: "hybrid" | "bm25" | "vector"` on `memory_search`.
4. **Zero-copy grounding:** Preserve `metadata.ref` pointers (`vault_path`, `wikilink`, `source_hash`, `section`) and external `grounded_in` relations so agents can inspect original source notes without lossy duplication.

## Consequences

- **Positive:** Zero-daemon install works immediately on any machine with Node 24; deterministic offline CI testing; Hybrid RRF beats both `bm25`-only (`81.3%` Recall@5) and `vector`-only (`81.3%` Recall@5) at `85.4%` Recall@5 and `76.2%` MRR on the offline eval suite.
- **Trade-off:** Dual indexing (`FTS5` + optional `sqlite-vec`) adds schema triggers and backfill logic, mitigated by automatic startup migration and `memory_reindex` rebuildability.

## Verification

- `pnpm verify` (offline tests + eval regression gate without Ollama).
- `npx tsx evals/run.ts --embedder hash --mode compare --noise 60`.
