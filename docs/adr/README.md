# Architecture Decision Records (ADRs)

This directory captures durable architectural decisions for **Cognitive Memory** so both human contributors and AI agents understand _why_ the system is designed the way it is.

| ADR                                                            | Title                                                         | Status   | Date       |
| -------------------------------------------------------------- | ------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-markdown-first-zero-ollama-hybrid-retrieval.md)    | Markdown-First Canonical Store & Zero-Ollama Hybrid Retrieval | Accepted | 2026-11-25 |
| [0002](0002-deterministic-first-engineering.md)                | Deterministic-First Engineering Principle                     | Accepted | 2026-11-25 |
| [0003](0003-temporal-supersession-and-bounded-graph.md)        | Temporal Supersession & Bounded 1–2 Hop Subgraph Retrieval    | Accepted | 2026-11-25 |
| [0004](0004-continuous-harness-and-eval-driven-development.md) | Continuous Harness Engineering & Regression-Driven Evals      | Accepted | 2026-11-25 |
| [0005](0005-frozen-3d-ui-and-cross-tool-focus.md)              | Frozen 3D Web UI & Vendor-Neutral Cross-Tool Focus            | Accepted | 2026-11-25 |

## Proposing a New ADR

1. Open an **RFC** in [GitHub Discussions](https://github.com/n1ghter/cognitive-memory/discussions) or reference the tracking Issue.
2. Add a numbered file `docs/adr/NNNN-short-kebab-title.md` with **Context**, **Decision**, **Consequences**, and **Verification**.
3. Update the index table above in the same PR.
