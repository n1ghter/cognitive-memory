# Annotation: NodeDetailsPanel.tsx
**Purpose:** Provides a glassmorphism slide-out sidebar for inspecting detailed memory node contents and metadata.
**Key Dependencies:** Consumes data provided by `MemoryGraph.tsx`. Uses standard React hooks for clipboard interaction and CSS classes for responsive positioning.
**Context:** Responsible for displaying full memory text, JSON-parsed metadata, source origin (Global vs Local), and connected memories. It triggers camera navigation back to `MemoryGraph` when connected nodes are clicked.
