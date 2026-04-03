---
title: Persist runtime source catalog for client-configured Kibana MCP sessions
date: 2026-04-03
category: integration-issues
module: kibana-mcp-server
problem_type: integration_issue
component: tooling
symptoms:
  - After an MCP update or restart, the agent had to call `configure` again before `discover` or `query` worked.
  - Kibana credentials were still available from environment variables, but the configured source catalog had disappeared.
root_cause: missing_tooling
resolution_type: tooling_addition
severity: medium
tags: [mcp, kibana, codex, configuration-persistence, source-catalog]
---

# Persist runtime source catalog for client-configured Kibana MCP sessions

## Problem

The Kibana MCP supported client-side `configure`, but that configuration only lived in process memory. Any MCP restart wiped the logical source catalog, so agents lost the ability to use `discover`, `filter`, and `query` until they reconfigured the server again.

## Symptoms

- Codex or MCP restarts caused the previously working Kibana session setup to disappear.
- The agent reported that the Kibana session config had been reset after an MCP update.
- Environment-based credentials still worked, but the source definitions needed for log queries were gone.

## What Didn't Work

- Relying on in-memory state set by `configure` alone. That made the current session work, but it guaranteed the next process restart would drop the source catalog.
- Assuming exported environment variables were enough. They preserved credentials, not the logical source configuration that had been provided dynamically by the client.

## Solution

Persist only the non-secret runtime source catalog to an untracked file and reload it automatically on startup.

Key changes:

- `configure` now writes `sources` to `config/sources.runtime.json`
- `.gitignore` excludes `config/sources.runtime.json`
- startup prefers `config/sources.runtime.json`, then falls back to `config/sources.json`
- Kibana credentials continue to come only from environment variables

Relevant implementation shape:

```ts
export const DEFAULT_RUNTIME_SOURCE_CATALOG_PATH = "config/sources.runtime.json";

export async function persistSourceCatalog(
  sources: AppConfig["sources"],
  envInput: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const sourceCatalogPath = resolveSourceCatalogPath(envInput);
  await mkdir(dirname(sourceCatalogPath), { recursive: true });
  await writeFile(
    sourceCatalogPath,
    `${JSON.stringify({ sources }, null, 2)}\n`,
    "utf8"
  );
  return sourceCatalogPath;
}
```

And startup now uses the runtime file by default:

```ts
export function resolveSourceCatalogPath(envInput: NodeJS.ProcessEnv = process.env): string {
  const explicitPath = envInput.KIBANA_SOURCE_CATALOG_PATH?.trim();
  if (explicitPath) {
    return explicitPath;
  }

  return DEFAULT_RUNTIME_SOURCE_CATALOG_PATH;
}
```

## Why This Works

The problem was not authentication. It was that the server had no durable store for client-supplied source definitions. Persisting the source catalog solves the exact gap without introducing secret sprawl:

- credentials remain in env
- source definitions survive process restarts
- the MCP can restart cleanly and still answer queries without another `configure` call

This keeps the client-driven configuration model while making it operationally stable under Codex MCP restarts.

## Prevention

- If an MCP accepts runtime configuration that is required for normal operation after startup, persist the non-secret portion instead of keeping it only in memory.
- Keep secrets and durable configuration separate. In this case:
  - secrets: environment variables
  - durable runtime state: `config/sources.runtime.json`
- Add a restart-oriented test or verification path whenever a tool mutates server state that agents depend on across calls.
- Prefer startup fallback order that matches operational reality:
  - runtime-persisted file first
  - static example or bootstrap file second

## Related Issues

- None found in `docs/solutions/` at the time of writing.
- Related implementation context:
  - `docs/plans/2026-04-02-001-feat-kibana-log-investigation-plan.md`
