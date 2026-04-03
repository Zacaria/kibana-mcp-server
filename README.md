# Kibana Log Investigation MCP

Read-only MCP server for agent-driven log investigation against Kibana-backed search endpoints protected with basic auth.

The server is intentionally small:

- `configure` sets Kibana credentials and the logical source catalog for the current server session
- `describe_fields` exposes effective field capabilities for one configured source
- `discover` lists configured logical sources and field hints
- `filter` runs an exact-field filter when the field name is already known
- `query` searches one or more sources over an absolute time window in `hits`, `count`, `histogram`, `terms`, `stats`, or `grouped_top_hits` mode

This is designed to stay general while still serving the logs-investigation portion of `../digital-api/STAGING_TEST_PROTOCOL.md`.

## Requirements

- Node.js 22+
- A Kibana-compatible read endpoint reachable with basic auth
- A source catalog JSON file describing the logical log sources to expose

## Installation

```bash
npm install
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

Current staging note:

- for `https://api.staging.clubmed.com/logs`, live checks showed that direct schema endpoints like `/api/data_views/fields_for_wildcard`, `/api/index_patterns/_fields_for_wildcard`, and `/<index>/_field_caps` return `404`
- the server now falls back to sampling fields through the working search backend when those direct metadata endpoints are unavailable
- this fallback is heuristic rather than authoritative, but it is enough to recover `.keyword` promotion and nested-path discovery in environments where only `/internal/search/es` is exposed

Recommended staging source shape for the consumer log stream:

```json
{
  "id": "ppr_api_notif_consumers",
  "name": "PPR API Notif Consumers",
  "timeField": "@timestamp",
  "backend": {
    "kind": "kibana_internal_search_es",
    "path": "/internal/search/es",
    "index": "ppr-api-notif-consumers"
  },
  "schema": {
    "kind": "kibana_data_views_fields",
    "index": "ppr-api-notif-consumers"
  }
}
```

Keep `schema.path` omitted for this staging setup. The server will try the known Kibana metadata endpoints first and then fall back to search-transport sampling if those endpoints still return `404`.

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
      "id": "consumer",
      "name": "Consumer cache refresh logs",
      "tags": ["consumer", "cache-refresh", "staging"],
      "timeField": "@timestamp",
      "backend": {
        "kind": "kibana_internal_search_es",
        "path": "/internal/search/es",
        "index": ["consumer-*"]
      },
      "schema": {
        "kind": "kibana_data_views_fields",
        "index": ["consumer-*"]
      },
      "fieldHints": [
        {
          "name": "requestId",
          "aliases": ["request_id"]
        }
      ],
      "defaultTextFields": ["message"],
      "evidenceFields": ["requestId"]
    }
  ]
}
```

If you do not bootstrap via env vars, call `configure` before `discover` or `query`.
Calling `configure` also persists the provided sources to the runtime source-catalog file so later restarts can reload them automatically.
If you want `describe_fields`, exact-field auto-resolution in `query`, or nested-filter validation, configure `schema` for each relevant source.
For the current staging Kibana endpoint at `https://api.staging.clubmed.com/logs`, prefer `schema.kind = "kibana_data_views_fields"` with `schema.index` set and omit `schema.path`.

### `discover`

Input:

```json
{
  "query": "consumer",
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
  "source_id": "reload-metrics",
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
  "source_ids": ["consumer", "reload-metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "text": "ICC:B2C_OPENING_DATES",
  "filters": [
    { "field": "locale", "value": "en-US" },
    { "field": "productId", "value": "12345" }
  ],
  "nested_filters": [
    {
      "path": "slowest_layers",
      "field": "layer",
      "value": "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3"
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
  "source_ids": ["reload-metrics"],
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
  "source_ids": ["reload-metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "mode": "stats",
  "stats_field": "total_duration_ms",
  "group_by": "request_id",
  "limit": 25
}
```

Example `grouped_top_hits` query:

```json
{
  "source_ids": ["reload-metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "mode": "grouped_top_hits",
  "group_by": "request_id",
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
  "source_ids": ["reload-metrics"],
  "start_time": "2026-04-02T12:00:00Z",
  "end_time": "2026-04-02T12:15:00Z",
  "field": "eventName.keyword",
  "value": "MEMOIZE_TREE_RELOAD_STATS",
  "nested_filters": [
    {
      "path": "slowest_layers",
      "field": "slowest_layers.layer.keyword",
      "value": "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3"
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
