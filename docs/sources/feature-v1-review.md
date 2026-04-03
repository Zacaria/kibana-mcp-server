# Feature v1 Review

## Scope

This review reflects live checks against the updated Kibana MCP server using a real Kibana deployment and one high-volume structured-log source.

## Closed Gaps

### 1. Config Persistence

This is now working.

Observed behavior:

- `configure` returned `persisted: true`
- `source_catalog_path` was reported as `config/sources.runtime.json`

Impact:

- source registration no longer appears to be purely in-memory
- this closes the earlier friction where MCP updates forced manual source reconfiguration every time

### 2. Cursor Pagination

This is now working.

Observed behavior:

- `filter(... mode="hits")` returned a `next_cursor`
- calling the same filter again with `cursor` returned the next page of hits correctly

Impact:

- large correlated timelines are now navigable
- this closes a major gap for high-volume request or workflow reconstruction

### 3. Numeric Sorting on Hits

This is still working and remains a useful capability.

Observed behavior:

- exact filter on `event.keyword = WORKFLOW_RELOAD_STATS`
- `sort_by = total_duration_ms`
- correct descending ranking of slow hits

Impact:

- performance-oriented log analysis can now stay inside the MCP

## Remaining Gaps

### 1. `describe_fields` Is Still Broken

This is not yet usable.

Observed behavior:

- `describe_fields(source_id="workflow_metrics", query="event")`
- `describe_fields(source_id="workflow_metrics", query="steps")`

Both failed with:

- Kibana `404 Not Found`

Impact:

- schema discovery is still missing in practice
- the agent still cannot reliably discover:
  - field types
  - aggregatable vs searchable fields
  - `.keyword` subfields
  - nested field structure

Required fix:

- make `describe_fields` resolve against the actual backend path and source configuration

### 2. Exact-Match Auto-Resolution Is Still Missing

This is still a real correctness issue.

Observed behavior:

- filtering on `field = event`, `value = CACHE_REFRESH_PHASES` returned `0` hits
- the MCP resolved the field as plain `event`
- the same search works when using `event.keyword`

Impact:

- false negatives are still easy to produce
- the user must still know internal mapping details

Required fix:

- either auto-upgrade `event` to `event.keyword` when exact matching on a text field
- or add an explicit `exact: true` mode
- or return a structured warning suggesting the keyword field

### 3. Nested Querying / Extraction Still Fails

This is still not operational.

Observed behavior:

- query attempted with:
  - `nested_filters`
  - path `steps`
  - field `name`
  - value `CACHE_REFRESH`
  - `extract_nested = true`
- result: Kibana `404 Not Found`

Impact:

- checks that depend on `steps[]` still cannot be done natively
- object-level validation inside `WORKFLOW_RELOAD_STATS` still requires manual raw-document inspection or external calls

Required fix:

- make nested filtering work against the configured search backend
- make nested extraction return matching nested objects, not just parent documents

## Summary

The updated server clearly improved in two important areas:

- persistent config
- cursor pagination

However, three high-value capabilities are still not usable in live checks:

1. `describe_fields`
2. exact-match safe field resolution
3. nested filtering and nested extraction

These are now the main remaining Kibana MCP gaps for schema-aware log investigation.
