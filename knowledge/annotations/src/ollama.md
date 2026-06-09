### Ollama Client Library
#### Purpose
The OllamaClient class is a direct interface to the Ollama API, enabling fast and optimized querying of the embedding model and local LLM inference.

#### Features

* Queries the /api/embed endpoint for embeddings using light native fetch.
* Queries the /api/generate endpoint for generated text using local LLM inference.
* Utilizes environment variables `OLLAMA_URL` and `EMBEDDING_MODEL` for configuration.
* Handles errors and logs exceptions to the console.

#### Interactions with

* SQLite tables (not explicitly listed, but the client library is designed to be extensible)
* The Ollama API at `http://127.0.0.1:11434` or specified by the `OLLAMA_URL` environment variable
* An embedding model as specified by the `EMBEDDING_MODEL` environment variable (defaulting to `qwen3-embedding:8b`)