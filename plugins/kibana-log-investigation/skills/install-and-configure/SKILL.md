---
name: install-and-configure
description: Install the repo-scoped Kibana log investigation plugin and configure its MCP server for a local Kibana environment.
---

# Install and Configure

Use this skill when the repository has been cloned locally and Codex needs to finish setup for the Kibana Log Investigation plugin.

## Goals

- ensure the local MCP server can start from this repository
- install the repo-scoped plugin from the local marketplace
- configure the MCP server with Kibana connection details and sources

## Workflow

1. Ensure Node.js 22+ is available:
   - if `node --version` is missing or older than `22`, use the `ensure-node-runtime` skill first
2. Verify the repo has dependencies and build artifacts:
   - if `node_modules/` is missing, run `npm install`
   - if `dist/src/index.js` is missing or stale, run `npm run build`
3. In Codex, open the plugin directory for this repo and install `Kibana Log Investigation` from the repo marketplace.
4. Restart Codex if the plugin directory does not refresh automatically.
5. After installation, use the MCP `configure` tool or startup env vars to provide:
   - `KIBANA_BASE_URL`
   - `KIBANA_USERNAME`
   - `KIBANA_PASSWORD`
   - source catalog entries
6. Prefer `config/sources.example.json` as the starting point for source definitions.

## Notes

- This plugin is repo-scoped and intended to be installed from a cloned checkout.
- The local MCP server runs through `node ./dist/src/index.js`.
- The plugin does not include credentials; those must be provided by the user or environment.
- The repo pins Node major `22` in `.node-version`.
