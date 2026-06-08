# AI Annotation: Deletion, Consolidation, and Graphing

**Target Files:** 
- `src/tools/delete.ts`
- `src/tools/consolidate.ts`
- `src/tools/graph.ts`

**Tables:** `memory`, `vec_memory`, `edges`

## Business Logic & "Why"

### 1. Delete (`delete.ts`)
- **Soft vs Hard Delete:** By default, deletion is a "Soft Delete" (`is_active = 0`). This allows us to keep the vector in the database for historical rollback or auditing without it showing up in `memory_search` queries.
- **Hard Delete:** Triggered only via explicit `hard=true` flag. This physically purges the row from both the standard table and the `vec0` virtual table.

### 2. Consolidate (`consolidate.ts`)
- **Memory Decay (Forgetting Curve):** An AI agent shouldn't remember everything forever with equal importance. `consolidate` calculates a time-decay metric combining `importance`, `accessed_count`, and `created_at`.
- **Deduplication:** Uses local Ollama LLMs to read low-importance or semantically duplicate active memories and rewrites them into a single, dense "consolidated" memory. The old ones are soft-deleted.

### 3. Graph Relate (`graph.ts`)
- **Graph Fallback:** While vector search is great for "fuzzy" semantic matching, sometimes we need explicit, hard logical connections (e.g., "Memory A *contradicts* Memory B"). 
- The `edges` table allows us to build a deterministic Knowledge Graph layered directly on top of the probabilistic Vector DB.
