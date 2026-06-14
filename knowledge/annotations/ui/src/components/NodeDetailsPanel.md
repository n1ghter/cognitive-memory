# Annotation: NodeDetailsPanel.tsx

**Purpose:** Renders the detail-on-demand right-side drawer containing specific metadata about a selected memory node.

**Key Dependencies:**
- Uses `lucide-react` for iconography (`Copy`, `Check`, `Database`, `Hash`, `X`).
- Relies on internal component state (`useState`) to track the temporary `copiedId` feedback status (2-second timeout).
- Accepts a `selectedNode` object passed down from `MemoryGraph.tsx`.

**Context:**
This component heavily utilizes modern CSS-in-JS (inline styles with `backdrop-filter: blur(24px)`) to achieve a glassmorphism effect. The `handleCopy` utility interacts with the native `navigator.clipboard` API to provide quick data extraction for power users. It is designed to be fully controlled via props (`onClose`).
