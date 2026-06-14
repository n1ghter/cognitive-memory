### Semantic Summary
#### Business Logic/Purpose

This file initializes the `memory-auto-capture` skill, which enables autonomous cognitive memory behavior across all workspaces and projects. It dynamically captures facts, preferences, decisions, and context using MCP tools (`cognitive-memory` with SQLite), updates and prunes stale memories, and relies on the registered server tool for management.

The skill is composed of four key components:

1.  Dynamic Cognitive Retrieval: Triggers retrieval based on Semantic Context Triggers (Uncertainty Trigger, Architecture Trigger, Error Match Trigger) to call MCP tools (`memory_search`).
2.  Event-Driven Real-Time Capture: Captures memories at Cognitive Milestones / Decision Points using MCP tool (`memory_store`) with `metadata.type` set to "semantic" or "episodic".
3.  Dynamic Milestone Capture: Captures episodic memory dynamically when specific tasks are completed or Git commits occur.
4.  Graph Relations and Housekeeping: Manages the memory database autonomously using various MCP tools for tool creation, deletion, consolidation, export, and clearing.

This skill is designed to enforce a forcing function for autonomous memory management in workspaces, ensuring that users complete an "Autonomous Memory Checklist" before concluding major tasks.