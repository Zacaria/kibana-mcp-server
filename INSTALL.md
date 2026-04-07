# Install In Codex

Use this document when handing the repository to another Codex user or agent and you want setup to be as automatic as possible from a cloned checkout.

This is the canonical install path today. Public package distribution is planned but not yet the default path (see `docs/project/distribution-strategy.md`).

Repository:

- Name: `kibana-mcp-server`
- GitHub: `https://github.com/Zacaria/kibana-mcp-server`
- Plugin name: `Kibana Log Investigation`

## Full-Auto Prompt

```text
Clone and set up the GitHub repository https://github.com/Zacaria/kibana-mcp-server for Codex end to end.

Goals:
1. Clone the repo locally.
   - The repo name is `kibana-mcp-server`.
2. Detect the current OS.
3. Ensure Node.js 22+ is installed at user level.
   - If Node is missing or too old, use the repo plugin skill `ensure-node-runtime`.
   - Do not require admin/system-wide installation.
   - On Windows, prefer PowerShell-native setup.
4. From the repo root, run:
   - npm install
   - npm run build
5. Open the cloned repo in Codex.
6. Install the repo-scoped plugin named `Kibana Log Investigation` from the local marketplace in this repo.
   - If the current model cannot complete the plugin install itself, give me the exact Codex UI steps to click manually, then continue the rest of setup after I confirm.
7. Restart Codex if needed so the MCP appears.
8. Ask me for a short environment name before configuring the MCP server.
   - Examples: `staging`, `prod`, `preprod`, `qa`
   - Use that environment name to derive the source catalog path automatically as `config/sources.<ENV_NAME>.json`
   - Ask whether I already keep environment-specific variables for that target, for example `KIBANA_BASE_URL_STAGING`, `KIBANA_USERNAME_STAGING`, `KIBANA_PASSWORD_STAGING`
   - If I need both staging and production, repeat this flow once per environment so each MCP entry gets its own derived source catalog path
9. Configure the MCP server for this Kibana environment:
   - KIBANA_BASE_URL=<KIBANA_BASE_URL>
   - KIBANA_USERNAME=<KIBANA_USERNAME>
   - KIBANA_PASSWORD=<KIBANA_PASSWORD>
   - KIBANA_SOURCE_CATALOG_PATH=config/sources.<ENV_NAME>.json
   - If I already use environment-specific host variables for that target, map them into the standard `KIBANA_*` variables for that MCP server entry
   - If I need both staging and production, create two distinct MCP server entries with separate names and separate derived `KIBANA_SOURCE_CATALOG_PATH` values.
10. Start from `config/sources.example.json` and create/adapt the source catalog for my environment.
11. Verify the MCP is usable by:
   - discovering sources
   - running one simple query
   - confirming the server is available in Codex
12. If something is blocked, adapt the setup and continue instead of stopping early.

Important constraints:
- Prefer repo-local/plugin-local setup over global machine changes.
- Prefer user-level installs.
- Do not assume Scoop is available on Windows.
- Use the plugin skills in this repo when relevant.
- The repo contains a repo-scoped plugin under `plugins/kibana-log-investigation`.
- The local plugin marketplace file is `.agents/plugins/marketplace.json`.
- The MCP entrypoint is the built file `dist/src/index.js`, referenced by `plugins/kibana-log-investigation/.mcp.json`.
- Ask for the environment name explicitly instead of inventing one, then derive `KIBANA_SOURCE_CATALOG_PATH` from that answer.
- Different target environments may already use different host variable names such as `KIBANA_BASE_URL_STAGING` and `KIBANA_BASE_URL_PROD`. That is fine. Map each target into the standard runtime variables `KIBANA_BASE_URL`, `KIBANA_USERNAME`, `KIBANA_PASSWORD`, and `KIBANA_SOURCE_CATALOG_PATH` for the specific MCP server entry.
- `KIBANA_BASE_URL` is a base prefix, not a full Kibana API endpoint. Keep paths such as `/internal/search/es` in the source backend config.
- Do not stop just because plugin installation requires one manual Codex UI step.
- At the end, summarize exactly what was installed, configured, and verified.
```

## Short Prompt

```text
Clone https://github.com/Zacaria/kibana-mcp-server, ensure Node.js 22+ at user level for the current OS, run npm install and npm run build, install the repo plugin `Kibana Log Investigation`, ask me for the environment name and derive `KIBANA_SOURCE_CATALOG_PATH` as `config/sources.<ENV_NAME>.json`, ask whether I already keep target-specific variables such as `KIBANA_BASE_URL_STAGING`, map those into the standard `KIBANA_*` variables for that MCP entry, configure it with my Kibana credentials, adapt the source catalog from config/sources.example.json, then verify discover + one query work in Codex.
```

## Repo Hints

- The repo pins Node major `22` in `.node-version`.
- The repo-scoped plugin marketplace is in `.agents/plugins/marketplace.json`.
- The plugin lives in `plugins/kibana-log-investigation`.
- The Node bootstrap skill is `plugins/kibana-log-investigation/skills/ensure-node-runtime/SKILL.md`.
- The setup skill is `plugins/kibana-log-investigation/skills/install-and-configure/SKILL.md`.

## Raw File Handoff

If a colleague receives only the raw `INSTALL.md` link, this file should still be enough context for an agent to proceed.

The agent should infer all of the following from this file alone:

- the GitHub repository to clone is `https://github.com/Zacaria/kibana-mcp-server`
- the repo contains a repo-scoped Codex plugin named `Kibana Log Investigation`
- the plugin lives at `plugins/kibana-log-investigation`
- the repo must be built with `npm install` and `npm run build` before the MCP can start
- Node.js major `22` is required
- the agent should continue through manual Codex UI plugin installation if autonomous installation is blocked

When sharing this document, prefer sending the raw link plus the Kibana credentials and environment-specific source details the installer will need.

## Manual Plugin Install Fallback

Some Codex model variants are less reliable at completing repo-local plugin installation from prompting alone, especially on Windows.

If the agent stalls on plugin installation:

1. Open this repo in Codex.
2. Open the plugin directory `plugins/kibana-log-investigation`.
3. Install `Kibana Log Investigation` from the repo-local marketplace.
4. Restart Codex if the MCP list does not refresh automatically.
5. Let the agent continue with MCP configuration and verification.

Treat the manual click as a supported fallback, not as a setup failure.

## Base URL Rule

`KIBANA_BASE_URL` must be the base prefix that the server should join with each source backend path.

Use values such as:

- `https://kibana.example.com`
- `https://gateway.example.com/logs` when Kibana is mounted under `/logs`

Do not use values such as:

- `https://kibana.example.com/internal/search/es`
- `https://gateway.example.com/logs/internal/search/es`

The source catalog already carries endpoint paths such as `/internal/search/es`.

## Staging And Production Side By Side

If operators need both staging and production in the same Codex workspace, register two MCP server entries that point at the same built repo but use different environment variables.

Give each entry:

- a distinct server name such as `kibana-staging` and `kibana-prod`
- its own `KIBANA_BASE_URL`
- its own credentials
- its own derived `KIBANA_SOURCE_CATALOG_PATH`, for example `config/sources.staging.json` and `config/sources.prod.json`

If the operator already keeps target-specific host variables, those can differ too, for example:

- `KIBANA_BASE_URL_STAGING`, `KIBANA_USERNAME_STAGING`, `KIBANA_PASSWORD_STAGING`
- `KIBANA_BASE_URL_PROD`, `KIBANA_USERNAME_PROD`, `KIBANA_PASSWORD_PROD`

For each MCP entry, map the target-specific host variables into the standard runtime names expected by the server:

- `KIBANA_BASE_URL`
- `KIBANA_USERNAME`
- `KIBANA_PASSWORD`
- `KIBANA_SOURCE_CATALOG_PATH`

Using separate source-catalog paths avoids one environment overwriting the other when `configure` persists runtime sources.
