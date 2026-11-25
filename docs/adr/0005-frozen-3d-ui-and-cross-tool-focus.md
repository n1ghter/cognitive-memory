# ADR 0005: Frozen 3D Web UI & Vendor-Neutral Cross-Tool Focus

- **Status:** Accepted
- **Date:** 2026-11-25
- **Related:** [ROADMAP.md](../../ROADMAP.md), [docs/RESEARCH_2026.md](../RESEARCH_2026.md)

## Context

In 2026, major AI coding tools (Claude Code Auto Memory + Auto Dream, Cursor, Antigravity) shipped strong built-in single-tool memory features. Competing head-to-head on single-IDE note-taking or flashy 3D graph visualization has poor ROI. However, every vendor's native memory remains locked inside its own silo, leaving multi-tool power users without a shared, portable memory layer.

Simultaneously, maintaining the Three.js/React 3D Force Graph dashboard (`ui/`) previously accounted for the vast majority of Dependabot security alerts and dependency churn without improving agent retrieval quality.

## Decision

1. **Freeze `ui/` in maintenance-only mode:** Keep the 3D Web UI functional, building, and passing tests (`pnpm --dir ui test`) in CI as an optional local read-only explorer (`pnpm dashboard`), and patch security vulnerabilities — but do **not** invest in new WebGL/Three.js UI features.
2. **Focus 100% of feature roadmap on vendor-neutral cross-tool memory:** Prioritize retrieval precision, Markdown/Obsidian symmetry, zero-dependency reliability, anti-smell `init`/lifecycle hooks, cross-tool importers/bridges (Claude Code, Cursor, Windsurf, Antigravity, Codex, Cline), and Streamable HTTP multi-client sharing.

## Consequences

- **Positive:** Smaller attack surface, clearer open-source positioning, and concentrated engineering bandwidth on capabilities no single-vendor IDE memory offers.
- **Trade-off:** Visual graph enhancements are explicitly out of scope unless contributed externally without expanding core runtime dependencies.

## Verification

- `ROADMAP.md` clearly documents `ui/` under **Frozen / Maintenance-Only**; issues touching `ui/` are labeled `area:ui-frozen`.
