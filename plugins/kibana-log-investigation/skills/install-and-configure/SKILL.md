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
   - if the current model cannot complete the plugin install itself, guide the user through the manual Codex UI click path and continue after confirmation
4. Restart Codex if the plugin directory does not refresh automatically.
5. Ask the user for a short environment name before writing MCP config.
   - Examples: `staging`, `prod`, `preprod`, `qa`
   - Derive `KIBANA_SOURCE_CATALOG_PATH` as `config/sources.<ENV_NAME>.json`
   - Ask whether the user already keeps environment-specific host variables for that target, for example `KIBANA_BASE_URL_STAGING`, `KIBANA_USERNAME_STAGING`, `KIBANA_PASSWORD_STAGING`
   - If the user needs more than one environment, repeat this once per environment so each MCP server entry gets its own catalog path
6. After installation, use the MCP `configure` tool or startup env vars to provide:
   - `KIBANA_BASE_URL`
   - `KIBANA_USERNAME`
   - `KIBANA_PASSWORD`
   - `KIBANA_SOURCE_CATALOG_PATH`
   - When the user already has target-specific host variable names, map them into these standard runtime names for the MCP server entry
   - source catalog entries
7. Prefer `config/sources.example.json` as the starting point for source definitions.

## Notes

- This plugin is repo-scoped and intended to be installed from a cloned checkout.
- The local MCP server runs through `node ./dist/src/index.js`.
- The plugin does not include credentials; those must be provided by the user or environment.
- Different target environments may use different host variable names. That is fine as long as each MCP server entry receives the standard runtime variables `KIBANA_BASE_URL`, `KIBANA_USERNAME`, `KIBANA_PASSWORD`, and `KIBANA_SOURCE_CATALOG_PATH`.
- `KIBANA_BASE_URL` is a base prefix. Keep endpoint paths such as `/internal/search/es` in the source config instead of appending them to the base URL.
- If the same repo is used for both staging and production, make sure each MCP server entry uses its own derived `KIBANA_SOURCE_CATALOG_PATH`.
- The repo pins Node major `22` in `.node-version`.
