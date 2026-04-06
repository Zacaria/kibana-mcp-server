# Install In Codex

Use this document when handing the repository to another Codex user or agent and you want setup to be as automatic as possible from a cloned checkout.

This is the canonical install path today. Public package distribution is planned but not yet the default path (see `docs/project/distribution-strategy.md`).

## Full-Auto Prompt

Replace the placeholders before sending:

```text
Clone and set up this repo for Codex end to end:

REPO: <REPO_URL>

Goals:
1. Clone the repo locally.
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
7. Restart Codex if needed so the MCP appears.
8. Configure the MCP server for this Kibana environment:
   - KIBANA_BASE_URL=<KIBANA_BASE_URL>
   - KIBANA_USERNAME=<KIBANA_USERNAME>
   - KIBANA_PASSWORD=<KIBANA_PASSWORD>
9. Start from `config/sources.example.json` and create/adapt the source catalog for my environment.
10. Verify the MCP is usable by:
   - discovering sources
   - running one simple query
   - confirming the server is available in Codex
11. If something is blocked, adapt the setup and continue instead of stopping early.

Important constraints:
- Prefer repo-local/plugin-local setup over global machine changes.
- Prefer user-level installs.
- Do not assume Scoop is available on Windows.
- Use the plugin skills in this repo when relevant.
- At the end, summarize exactly what was installed, configured, and verified.
```

## Short Prompt

```text
Clone <REPO_URL>, ensure Node.js 22+ at user level for the current OS, run npm install and npm run build, install the repo plugin `Kibana Log Investigation`, configure it with my Kibana credentials, adapt the source catalog from config/sources.example.json, then verify discover + one query work in Codex.
```

## Repo Hints

- The repo pins Node major `22` in `.node-version`.
- The repo-scoped plugin marketplace is in `.agents/plugins/marketplace.json`.
- The plugin lives in `plugins/kibana-log-investigation`.
- The Node bootstrap skill is `plugins/kibana-log-investigation/skills/ensure-node-runtime/SKILL.md`.
- The setup skill is `plugins/kibana-log-investigation/skills/install-and-configure/SKILL.md`.
