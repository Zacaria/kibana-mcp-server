# Handoff

## Goal

Build a minimal MCP interface that lets another agent investigate runtime behavior in logs without direct Kibana access.

This handoff is intentionally abstracted from the current business case. The objective is not to encode one incident, but to provide the smallest useful log-investigation surface for staging or production validation work.

## Minimum toolset

The minimum useful MCP surface is:

1. `discover`
2. `query`

That is enough for the intended workflows.

## `discover`

### Purpose

Let an agent find which log sources are relevant before querying them.

### Required capabilities

- list available log sources
- search sources by keyword
- return identifiers and basic metadata for each source

### Expected output

For each source, return at least:

- source id
- human-readable name
- time field
- short description if available

The result should make source selection straightforward for an agent.

## `query`

### Purpose

Let an agent query logs in a structured and repeatable way.

### Required capabilities

- select one or more sources
- filter by time range
- filter by exact fields
- filter by free-text keywords
- sort by time
- limit result size
- return matching raw documents

### Optional capabilities

If easy to add within the same tool, support:

- count-only queries
- simple aggregations
- grouped counts over time

These are useful, but not required for the first version.

## Core agent workflows this MCP must support

The agent must be able to use these tools to answer generic runtime questions such as:

### 1. Find the relevant execution window

Given a timestamp, a rough keyword, or a functional area, find the relevant logs around the event.

### 2. Correlate multiple sources

Inspect one source for execution logs and another for API or application behavior in the same time window.

### 3. Narrow the investigation iteratively

Support a workflow like:

- start with a broad time window
- find candidate events
- narrow the range
- inspect the exact execution span

### 4. Extract structured evidence

Allow the agent to retrieve enough detail to build a report containing:

- timestamps
- identifiers
- durations or timing-related fields if present
- event names
- relevant field values

### 5. Compare before / during / after

Allow the agent to compare log activity and request behavior across several windows around the same event.

## Agent-facing ergonomics

The tools should be optimized for repeated use by another agent.

### `discover`

Should work well with short search inputs like:

- service name
- domain keyword
- event keyword
- environment keyword

### `query`

Should work well with:

- source ids from `discover`
- absolute start/end timestamps
- exact-match field filters
- text filters
- explicit sort order
- explicit limits

The response should expose hits clearly, without unnecessary wrapper noise.

## Success criteria

This MCP is sufficient if another agent can:

1. find the right log sources
2. query them over precise time ranges
3. correlate activity across sources
4. extract concrete evidence for a runtime investigation
5. produce a compact validation or incident report from those results

## Non-goals

This MCP does not need to:

- manage dashboards
- edit visualizations
- mutate saved objects
- expose administration features
- model business-specific workflows directly

The goal is a focused query surface for agents, not a full Kibana management interface.

## Suggested final shape

A good first version can expose exactly:

- `discover`
- `query`

Only add more tools later if the two-tool model proves insufficient.
