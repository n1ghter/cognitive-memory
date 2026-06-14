# Annotation: MemoryGraph.tsx
**Purpose:** Handles the core interactive 2D/3D visualization of the graph-vector memory engine. Provides spatial exploration of semantic relationships.
**Key Dependencies:** Uses `react-force-graph-2d` and `react-force-graph-3d` with `three.js`. Interfaces directly with the `/api/graph` backend endpoint.
**Context:** This component translates backend `node.val` scores into dynamic HSL color gradients, separating domains (Global vs Local) using a hot/cool heat scale. It serves as the primary visual interface and should remain performant by leveraging canvas/WebGL rendering without overloading React state.
