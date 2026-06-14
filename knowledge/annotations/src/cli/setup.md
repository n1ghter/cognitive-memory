### Semantic Summary
#### Business Logic and Architectural Purpose

This script is responsible for scanning for installed AI agents and IDEs, detecting if their configuration files already contain cognitive-memory setup. If a file needs updating with the standard MCP config, it injects or appends this to the relevant path.

Exposed tools:
* `fs`
* SQLite tables are not interacted with in this script

#### Why
This script's purpose is to facilitate the automation and consistency of setting up the Cognitive Memory Protocol (MCP) across various configurations and platforms.