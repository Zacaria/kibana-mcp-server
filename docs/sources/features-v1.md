# Kibana MCP Feature Additions v1

## Goal

Close the remaining gaps that prevented the Kibana MCP from fully covering the log-analysis workflow in `STAGING_TEST_PROTOCOL.md` without falling back to direct Elasticsearch calls or manual inspection.

## Additions

### 1. Field and Mapping Introspection

Add a tool that exposes the effective schema for a configured source.

Proposed tool:

- `describe_fields(source_id)`

Expected output:

- field name
- field type
- whether the field is searchable
- whether the field is aggregatable
- available subfields such as `.keyword`

Why this is needed:

- `event` and `event.keyword` behave differently.
- exact match on `event` can return false negatives
- aggregating on `event` can fail with fielddata errors
- the agent should not have to guess which field variant is safe

### 2. Exact-Match Field Resolution

Improve filtering so exact-match intent works without knowing the underlying mapping details.

Options:

- add `exact: true` to `query` and `filter`
- or automatically prefer `.keyword` when the requested field is text and a keyword subfield exists
- or return a structured warning with the suggested replacement field

Why this is needed:

- `event = PRODUCT_OPENING_DATES_REFRESH_PHASES` returned `0` hits
- `event.keyword = PRODUCT_OPENING_DATES_REFRESH_PHASES` returned the expected results

### 3. Nested Array Querying

Support filtering inside nested arrays in structured log documents.

Proposed capability:

- nested filter support for fields such as `slowest_layers.layer`

Example use cases:

- find `MEMOIZE_TREE_RELOAD_STATS` where `slowest_layers.layer = MEMOIZE_V3:PRODUCT_OPENING_DATES_V3`
- find reload stats where a nested layer has `keys_scanned = 0`

Why this is needed:

- critical protocol checks rely on inspecting specific layers inside `slowest_layers[]`
- current MCP only returns the whole parent document

### 4. Nested Projection / Extraction

When a nested match is found, allow returning only the matching nested object instead of the entire parent hit.

Proposed capability:

- `extract_nested` or equivalent result shaping for nested matches

Example output:

- parent identifiers: `@timestamp`, `request_id`, `product_id`
- matching nested object:
  - `layer`
  - `duration_ms`
  - `keys_scanned`
  - `keys_reloaded`
  - `keys_changed`

Why this is needed:

- the current raw hit is too bulky for precise layer-level analysis
- protocol steps need compact evidence for one layer at a time

### 5. Cursor-Based Pagination

Add pagination for large hit sets.

Proposed capability:

- cursor or `search_after` style pagination for `hits`
- pagination for `terms` results where applicable

Why this is needed:

- some correlated flows produce tens of thousands of hits
- one `request_id` returned more than `80,000` documents
- the current MCP only exposes the first `limit` hits

### 6. Numeric Stats Aggregations

Add numeric summary aggregations on arbitrary fields.

Proposed capability:

- `stats(field)`
- optional `group_by`

Expected metrics:

- `min`
- `max`
- `avg`
- `sum`
- `count`
- `p50`
- `p95`
- `p99`

Example use cases:

- summarize `total_duration_ms` for `MEMOIZE_TREE_RELOAD_STATS`
- compare `duration_ms` by locale or by request id

Why this is needed:

- protocol decisions depend on cost and latency patterns, not only on raw hits

### 7. Grouped Top Hits

Add bucketed top-hit retrieval.

Proposed capability:

- group by one field, then return top hits sorted by another field

Example use cases:

- top `MEMOIZE_TREE_RELOAD_STATS` by `total_duration_ms` per `request_id`
- latest `PRODUCT_OPENING_DATES_REFRESH_PHASES` per `product_id`
- highest `total_duration_ms` per `locale`

Why this is needed:

- global sorting is not enough when the workflow needs “worst per correlation key”

### 8. Correlation Timeline Helper

Add a higher-level timeline tool for reconstructing one execution flow.

Proposed capability:

- merged, chronologically sorted timeline over a source and a time window
- filterable by combinations of:
  - `request_id`
  - `task_id`
  - `product_id`
  - `locale`
  - `root_key`
  - `event`

Why this is needed:

- `request_id` alone is not always a single-run correlation key
- staging analysis often requires `request_id + timestamp window + product_id/locale/root_key`
- the protocol explicitly asks for correlated reload inspection

### 9. Config Bootstrap From Environment

Add a convenience helper for restoring the MCP session quickly.

Proposed capability:

- `configure_from_env`

Suggested env support:

- `KIBANA_BASE_URL`
- `KIBANA_USERNAME`
- `KIBANA_PASSWORD`

Why this is needed:

- MCP configuration was lost after the server update
- re-registering sources manually adds avoidable friction

## Summary

The current MCP already covers:

- exact keyword filtering
- sorting hits by numeric fields
- grouping by `event.keyword`

The remaining gaps are:

- schema discovery
- exact-match safety
- nested layer analysis
- deep pagination
- numeric aggregation
- grouped top-hit retrieval
- timeline reconstruction
- config bootstrap
