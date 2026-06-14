# Annotation: .github/workflows/auto-create-pr.yml
**Purpose:** Automatically creates a pull request when a new branch is pushed and immediately enables auto-merge for it.
**Key Dependencies:** Requires the `gh` CLI tool (pre-installed on GitHub-hosted runners) and the default `GITHUB_TOKEN`.
**Context:** The workflow demands `contents: write` and `pull-requests: write` permissions because both opening a PR and toggling the auto-merge flag (a repository modification) require elevated rights. It fails silently if the PR already exists, ensuring idempotent execution.
