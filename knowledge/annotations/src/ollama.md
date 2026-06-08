### Ollama Client Semantic Summary
#### Purpose
The `OllamaClient` class provides a direct interface to the Ollama API for efficient embedding and generation tasks.

#### Exposes MCP Tools/SQLite Interactions
- SQLite: None
- MCP tools: Light native fetch

#### Business Logic
The client allows for:

* Embedding text using the `/api/embed` endpoint, which returns an array of embeddings as numbers.
* Generating text using the `/api/generate` endpoint, which returns generated text as a string.