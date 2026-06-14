# Annotation: MemoryGraph.tsx
**Purpose:** Renders the interactive 3D Force-Directed Graph of the global and local memory network.
**Key Dependencies:** Uses `react-force-graph-3d`, `d3-force`, and `THREE.js` for rendering and physics optimization.
**Context:** This module acts as the core visual dashboard, orchestrating search queries, quick filters, camera transitions, and UX responsive overlays (search, filter, controls, details panel). It passes node data to `NodeDetailsPanel` for deep inspection.
