```markdown
### Demo Export Tool

The demo export tool is responsible for generating a memory graph based on user interactions with the AI memory agent in TypeScript. It stores user preferences and project information in a database, creates graph relations between related memories, and exports the resulting graph as a data structure for analysis or visualization.

This tool interacts with the `DatabaseManager` class to delete existing data from the `edges`, `vec_memory`, and `memory` tables before populating them with sample data. It also uses the `executeMemoryStore` and `executeMemoryRelate` tools to store memory records and create graph relations, respectively.
```