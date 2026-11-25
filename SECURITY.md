# Security Policy

## Supported Versions

Security fixes and dependency updates are actively provided for the current major release line:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0.0 | :x:                |

## Security Architecture Defaults

`cognitive-memory` is designed to run **local-first** and **secure by default**:

- **Stdio transport (default):** Communicates strictly over stdin/stdout with zero listening network sockets.
- **HTTP/SSE transport (`--sse`):**
  - Binds exclusively to loopback (`127.0.0.1`) by default.
  - Restricts CORS to localhost origins unless explicitly overridden via `MCP_CORS_ORIGIN`.
  - Refuses to bind to non-loopback hosts (e.g., `0.0.0.0`) unless `MCP_AUTH_TOKEN` is configured, enforcing timing-safe Bearer token validation on every request.
- **Zero-telemetry / offline operation:** Core retrieval (`SQLite FTS5` BM25) and Markdown reindexing make zero outbound network calls.

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public GitHub issue**.

Instead, report it privately using [GitHub Security Advisories](https://github.com/n1ghter/cognitive-memory/security/advisories/new).

Please include:

- A concise description of the vulnerability and potential impact.
- Deterministic reproduction steps or a minimal proof of concept.
- Affected version(s), transport mode (`stdio` / `sse` / `docker`), and Node.js version.

We aim to acknowledge reports within 48 hours and coordinate a verified patch before public disclosure.
