# Annotation: MemoryGraph.tsx

**Purpose:** Main visualization component for the Cognitive Memory ecosystem. Renders a unified 2D/3D force-directed graph representation of episodic and semantic memories.

**Key Dependencies:**
- Uses `react-force-graph-2d` and `react-force-graph-3d` for rendering.
- Uses `three.js` for custom physical materials and geometries (`THREE.MeshPhysicalMaterial`).
- Interacts with `/api/graph` to fetch structural graph data from the backend SQLite vector database.
- Renders `NodeDetailsPanel` for detailed, localized node metadata on click.

**Context:**
This component manages complex interactive states including viewport zooming, 3D camera positioning, local search highlighting (with smooth camera cycling), and keyboard accessibility (`Escape` handling). Modifying state here must account for high-performance WebGL context updates and React hook dependencies.
