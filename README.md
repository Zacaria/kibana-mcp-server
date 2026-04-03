# Kibana Log Investigation MCP

Read-only MCP server for agent-driven log investigation against Kibana-backed search endpoints protected with basic auth.

The server is intentionally small:

- `configure` sets Kibana credentials and the logical source catalog for the current server session
- `describe_fields` exposes effective field capabilities for one configured source
- `discover` lists configured logical sources and field hints
- `filter` runs an exact-field filter when the field name is already known
- `query` searches one or more sources over an absolute time window in `hits`, `count`, `histogram`, `terms`, `stats`, or `grouped_top_hits` mode

It is designed as a general-purpose log investigation MCP for environments where operators can expose a small set of useful logical sources.

## Requirements

- Node.js 22+
- A Kibana-compatible read endpoint reachable with basic auth
- A source catalog JSON file describing the logical log sources to expose

## Installation

```bash
npm install
```

## Use In Codex

This repo includes a repo-scoped Codex plugin so a cloned checkout can install the MCP without any extra packaging or hosted infrastructure.

### Quick path

1. Clone the repository.
2. Make sure Node.js 22+ is available.
   - if it is missing, ask Codex to use the plugin skill `ensure-node-runtime`
   - the repo pins Node major `22` in `.node-version`
3. From the repo root, run:

```bash
npm install
npm run build
```

4. Open the cloned repo in Codex.
5. Open the plugin directory in Codex and install `Kibana Log Investigation` from the repo marketplace.
6. Restart Codex if the new MCP server does not appear immediately.
7. Configure the server with Kibana credentials and sources:
   - either call the MCP `configure` tool
   - or set `KIBANA_*` env vars and use a local source-catalog file

Repo-scoped plugin files:

- `.agents/plugins/marketplace.json`
- `plugins/kibana-log-investigation/.codex-plugin/plugin.json`
- `plugins/kibana-log-investigation/.mcp.json`

### Minimal handoff prompt

If you are handing only the repo link to another Codex agent, this usually works:

```text
Clone this repo, ensure Node.js 22+ is installed at user level for the current OS, run npm install and npm run build, install the repo plugin named "Kibana Log Investigation", then configure it for my Kibana environment.
```

## Configuration

The server can be configured in either of two ways:

- bootstrap at process start through environment variables plus a JSON source catalog
- runtime from your MCP client through the `configure` tool

Runtime configuration is now the preferred path when your client is responsible for credentials and source selection.
When `configure` is called, the source catalog is also persisted to `config/sources.runtime.json` by default so MCP restarts do not wipe the logical source setup.

### Bootstrap configuration

The server can still read connection details from environment variables and source definitions from a JSON file.

Environment variables:

- `KIBANA_BASE_URL`
- `KIBANA_USERNAME`
- `KIBANA_PASSWORD`
- `KIBANA_TIMEOUT_MS` optional, default `10000`
- `KIBANA_SOURCE_CATALOG_PATH` optional, default `config/sources.runtime.json`

Start from `config/sources.example.json` and copy it to `config/sources.json`.
If no explicit `KIBANA_SOURCE_CATALOG_PATH` is set, startup will try `config/sources.runtime.json` first and then fall back to `config/sources.json`.

Each source definition should provide:

- stable `id`
- human-readable `name`
- `timeField`
- `tags` and optional `description`
- `fieldHints` so agents can form exact-match filters
- `defaultTextFields` for free-text search
- `evidenceFields` to elevate likely report-worthy fields
- `backend` describing how the source is queried
- optional `schema` describing how field introspection is performed for `describe_fields` and other schema-dependent features

Supported backend kinds:

- `kibana_internal_search_es`
  - POSTs to a Kibana endpoint like `/internal/search/es`
  - wraps the query body inside `{ "params": { "index": ..., "body": ... } }`
  - adds `kbn-xsrf`
- `elasticsearch_search`
  - POSTs the compiled Elasticsearch body directly to the configured path

Supported schema backend kinds:

- `kibana_data_views_fields`
  - tries Kibana wildcard field-metadata endpoints, preferring `/internal/data_views/_fields_for_wildcard`
  - adds `pattern=...` from `schema.index` or `backend.index`
  - if all known field-metadata endpoints return `404`, falls back to sampling fields through the configured search backend
- `kibana_index_patterns_fields`
  - tries the legacy wildcard field-metadata endpoint `/api/index_patterns/_fields_for_wildcard` and related fallbacks
  - adds `pattern=...` from `schema.index` or `backend.index`
  - if all known field-metadata endpoints return `404`, falls back to sampling fields through the configured search backend
- `elasticsearch_field_caps`
  - GETs an Elasticsearch field capabilities endpoint such as `/<index-pattern>/_field_caps?fields=*`
  - uses `schema.path` when provided or derives the default from `schema.index`

Deployment note:

- some Kibana deployments expose search transport but not field-metadata endpoints
- when direct schema endpoints such as `/api/data_views/fields_for_wildcard`, `/api/index_patterns/_fields_for_wildcard`, or `/<index>/_field_caps` return `404`, the server falls back to sampling fields through the configured search backend
- this fallback is heuristic rather than authoritative, but it is often sufficient to recover `.keyword` promotion and object-path discovery in search-only environments

Example source shape for an application log stream:

```json
{
  "id": "app_logs",
  "name": "Application Logs",
  "timeField": "@timestamp",
  "backend": {
    "kind": "kibana_internal_search_es",
    "path": "/internal/search/es",
    "index": "app-logs-*"
  },
  "schema": {
    "kind": "kibana_data_views_fields",
    "index": "app-logs-*"
  }
}
```

Keep `schema.path` omitted for this setup. The server will try the known Kibana metadata endpoints first and then fall back to search-transport sampling if those endpoints still return `404`.

## Running

```bash
KIBANA_BASE_URL=https://kibana.example.com \
KIBANA_USERNAME=elastic \
KIBANA_PASSWORD=secret \
KIBANA_SOURCE_CATALOG_PATH=config/sources.json \
npm run dev
```

## Tool Shapes

### `configure`

Input:

```json
{
  "kibana": {
    "baseUrl": "https://kibana.example.com",
    "username": "elastic",
    "password": "secret",
    "timeoutMs": 10000
  },
  "sources": [
    {
      "id": "app_logs",
      "name": "Application Logs",
      "tags": ["app", "logs", "production"],
      "timeField": "@timestamp",
      "backend": {
        "kind": "kibana_internal_search_es",
        "path": "/internal/search/es",
        "index": ["app-logs-*"]
      },
      "schema": {
        "kind": "kibana_data_views_fields",
        "index": ["app-logs-*"]
      },
      "fieldHints": [
        {
          "name": "traceId",
          "aliases": ["trace_id"]
        }
      ],
      "defaultTextFields": ["message"],
      "evidenceFields": ["traceId"]
    }
  ]
}
```

If you do not bootstrap via env vars, call `configure` before `discover` or `query`.
Calling `configure` also persists the provided sources to the runtime source-catalog file so later restarts can reload them automatically.
If you want `describe_fields`, exact-field auto-resolution in `query`, or nested-filter validation, configure `schema` for each relevant source.
In deployments where schema endpoints are routed indirectly or return `404`, prefer `schema.kind = "kibana_data_views_fields"` with `schema.index` set and omit `schema.path`.

### `discover`

Input:

```json
{
  "query": "application",
  "limit": 10
}
```

Output includes:

- source id
- source name
- time field
- tags
- configured field hints

### `describe_fields`

Use `describe_fields` when the agent needs to know whether a field is safe for exact term matching, grouping, or sorting.
If the source does not configure a schema backend, `describe_fields` fails clearly instead of guessing.
When direct schema endpoints are unavailable, the server will infer fields from sample hits via the configured search backend.

Input:

```json
{
  "source_id": "workflow_metrics",
  "query": "event",
  "limit": 50
}
```

Output includes:

- field name
- field type
- `searchable`
- `aggregatable`
- available subfields
- `preferred_exact_field` when a safer exact-match variant exists, such as `.keyword`

### `query`

Input:

```json
{
  "source_ids": ["app_logs", "workflow_metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "text": "SERVICE_RELOAD",
  "filters": [
    { "field": "region", "value": "us-east-1" },
    { "field": "traceId", "value": "trace-12345" }
  ],
  "nested_filters": [
    {
      "path": "steps",
      "field": "name",
      "value": "CACHE_REFRESH"
    }
  ],
  "extract_nested": true,
  "mode": "hits",
  "sort_by": "total_duration_ms",
  "sort": "desc",
  "limit": 50
}
```

Supported modes:

- `hits`
- `count`
- `histogram`
  - requires `histogram_interval`
- `terms`
  - requires `group_by`
- `stats`
  - requires `stats_field`
  - can also take `group_by`
- `grouped_top_hits`
  - requires `group_by`
  - requires `sort_by`
  - accepts `top_hits_size`

Every response includes a `query_echo` section so the investigating agent can explain which sources, bounds, filters, and mode were actually used.
For `hits` mode, you can also pass `sort_by` to sort on a chosen field. In `query`, exact filters and grouped bucket fields use field-hint alias resolution plus schema-aware exact-field preference when metadata is available. When the server rewrites a logical field such as `event` to a safer exact field such as `event.keyword`, the response includes an advisory. If schema metadata is unavailable, the query proceeds with the requested field and returns a `schema_unavailable` advisory instead of silently pretending exact-safe resolution happened.

For very large single-source hit sets, `query` also supports cursor pagination:

```json
{
  "source_ids": ["workflow_metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "mode": "hits",
  "limit": 100,
  "cursor": "REPLACE_ME_NEXT_CURSOR"
}
```

Cursor pagination is currently supported only for single-source `hits` queries.

Nested filtering also depends on schema metadata. If a source does not expose a working `schema` backend, nested requests fail early with a clear configuration error instead of reaching Kibana and failing with a backend 404.

Example `stats` query:

```json
{
  "source_ids": ["workflow_metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "mode": "stats",
  "stats_field": "total_duration_ms",
  "group_by": "trace_id",
  "limit": 25
}
```

Example `grouped_top_hits` query:

```json
{
  "source_ids": ["workflow_metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "mode": "grouped_top_hits",
  "group_by": "trace_id",
  "sort_by": "total_duration_ms",
  "top_hits_size": 1,
  "limit": 25
}
```

### `filter`

Use `filter` when you already know the backend field you want to target and want to avoid alias resolution.

Input:

```json
{
  "source_ids": ["workflow_metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "field": "eventName.keyword",
  "value": "WORKFLOW_RELOAD_STATS",
  "nested_filters": [
    {
      "path": "steps",
      "field": "steps.name.keyword",
      "value": "CACHE_REFRESH"
    }
  ],
  "extract_nested": true,
  "mode": "hits",
  "sort_by": "total_duration_ms",
  "limit": 50
}
```

`filter` returns the same structured output envelope as `query`, but it does not apply field-hint alias rewrites.
If schema metadata is available and you pass a logical text field such as `event`, the server may still promote it to a preferred exact field such as `event.keyword` for exact term matching. If you pass an exact backend field like `event.keyword`, it is used as-is.
`sort_by` is supported for `hits` and `grouped_top_hits`.

## Development

```bash
npm test
npm run check
```
