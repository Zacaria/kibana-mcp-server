---
date: 2026-04-02
topic: kibana-logs-mcp
focus: mcp server for agent log search in basic-auth-protected Kibana, re-grounded on ../digital-api/STAGING_TEST_PROTOCOL.md
---

# Ideation: Kibana Logs MCP

## Codebase Context

The current repo is intentionally minimal and currently contains only `docs/sources/handoff.md` plus documentation artifacts. There is no existing implementation to constrain architecture, so the main grounding sources are the local handoff and the adjacent staging-validation protocol at `../digital-api/STAGING_TEST_PROTOCOL.md`.

One repo-level note: `AGENTS.md` references `RTK.md`, but no such file exists in this workspace. The practical grounding sources for this ideation are therefore the handoff and the staging protocol, not any missing repo convention document.

Observed constraints from the handoff:

- the MCP surface should stay very small, with `discover` and `query` as the suggested default shape
- the server is read-only and exists to support runtime investigation, not Kibana administration
- the consumer is another agent, so repeatability and explicit parameters matter more than convenience for humans
- cross-source correlation and iterative narrowing are first-class use cases
- exact-field filtering is a required capability, which implies some form of schema or field-awareness for agents

Observed constraints from `../digital-api/STAGING_TEST_PROTOCOL.md` for the logs-investigation aspect:

- the agent must reconstruct one staging reload investigation around a precise trigger timestamp
- the key log surfaces are consumer logs, API logs, and metric-like log events such as `MEMOIZE_TREE_RELOAD_STATS` and `PRODUCT_OPENING_DATES_REFRESH_PHASES`
- the agent must search by text markers such as `ICC:B2C_OPENING_DATES`, then narrow by time window and identifiers like locale, product id, or request id when those fields exist
- the agent must compare before/during/after windows and extract concrete evidence for a merge-safety verdict
- Redis inspection and staging API execution matter to the full protocol, but they are outside the logs-only MCP scope requested here

Obvious leverage points:

- make `discover` good enough that agents can reliably find the right logical sources and likely usable fields without trial-and-error
- make `query` expressive enough to cover time windows, exact filters, free text, multi-source correlation, and lightweight aggregate modes like counts and histograms
- shape results for evidence extraction so an agent can quote timestamps, layers, durations, identifiers, and source provenance directly
- keep the product general by configuring sources and field hints, not by hardcoding one incident workflow
- treat the two-tool boundary as a strong default, not a dogma, and only add another tool if it removes real agent friction that cannot fit cleanly inside the core model

Past learnings:

- no `docs/solutions/` material was present in this workspace
- one prior ideation artifact existed and was resumed in this refinement pass
- no external research was used in this ideation pass

## Ranked Ideas

### 1. Configured Source Catalog With Field Hints
**Description:** Build `discover` around a configured catalog of logical sources instead of trying to infer the entire Kibana world on day one. Each source should expose a stable id, human-readable name, time field, tags, short description, and a compact set of likely filter fields or aliases. This lets operators define sources like consumer, API, and metrics-style logs without hardcoding one incident into the server.
**Rationale:** For the staging protocol, the agent needs a short path to the right sources. A configured catalog is both simpler and more reliable than dynamic full-environment discovery, while remaining general because the catalog is environment-driven rather than protocol-specific.
**Downsides:** It pushes some setup burden onto the operator and may hide unconfigured sources until the catalog is updated.
**Confidence:** 96%
**Complexity:** Medium
**Status:** Unexplored

### 2. Multi-Mode `query`
**Description:** Keep one primary `query` tool, but let it operate in `hits`, `count`, `histogram`, and simple grouping modes instead of only raw-hit retrieval. The tool should support explicit source selection, absolute time windows, exact filters, text filters, sort order, and limits.
**Rationale:** This matches the staging workflow directly. The agent can start broad with counts or histograms, find the relevant execution window, and then switch to hits to inspect `ICC:B2C_OPENING_DATES`, `MEMOIZE_TREE_RELOAD_STATS`, or `PRODUCT_OPENING_DATES_REFRESH_PHASES` evidence without needing extra tools.
**Downsides:** The parameter model becomes more complex and needs strict validation to stay agent-friendly.
**Confidence:** 94%
**Complexity:** Medium
**Status:** Unexplored

### 3. Correlation-First Response Shape
**Description:** Make `query` return a normalized result shape that is easy to correlate across sources. Every hit should include normalized timestamp, source id, a message-like summary, selected evidence fields, and the raw document. Aggregate modes should return equally clear series or grouped counts with explicit source and field context.
**Rationale:** The staging protocol is fundamentally about reconstructing one incident across multiple log surfaces. If the response shape is correlation-first, the agent can align consumer events, API observations, and metric-like log lines without backend-specific parsing every time.
**Downsides:** Over-normalization can hide source-specific richness unless the raw document remains available.
**Confidence:** 91%
**Complexity:** Medium
**Status:** Unexplored

### 4. Explainable Query Compiler
**Description:** Make `query` accept a clean agent-facing parameter model and return the compiled query representation alongside results. The response should echo the effective source set, normalized time bounds, exact filters, text filters, sort order, limits, truncation decisions, and the effective query mode.
**Rationale:** Agents need repeatable behavior, not mystery translation. Echoing the compiled query makes investigations auditable and easier to debug when an agent narrows the search around a staging trigger timestamp.
**Downsides:** Adds response payload overhead and requires discipline in the query abstraction so the echoed form stays truthful.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 5. Safe Auth and Read-Only Connectivity Envelope
**Description:** Treat Kibana basic auth, endpoint configuration, timeouts, and read-only capability checks as product features rather than wiring details. Failures should be explicit and operator-facing, not hidden inside vague tool errors.
**Rationale:** The use case only works if the MCP can connect reliably to a secured environment and fail clearly when credentials, permissions, or endpoints are wrong. Reliability here is part of functionality.
**Downsides:** It does not expand investigative power directly, and some environments may make capability validation awkward.
**Confidence:** 92%
**Complexity:** Low
**Status:** Unexplored

### 6. Flexible Third-Tool Boundary
**Description:** Start with `discover` and `query`, but explicitly reserve the right to add a narrow `describe_source` or similar introspection tool if the field-hint payload inside `discover` becomes either too noisy or too weak for agents.
**Rationale:** The staging use case still points toward a two-tool default, but field ambiguity is the most likely reason that boundary would crack. Naming the escape hatch now keeps the architecture honest.
**Downsides:** It creates temptation to expand prematurely, so the bar for a third tool must stay high.
**Confidence:** 86%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Dynamic crawl of every Kibana source in v1 | Too expensive and brittle for the simplest functional path; a configured source catalog is more reliable for the staging use case while staying general. |
| 2 | Hard-code exactly two tools forever | Too rigid given the likely need for schema introspection if discovery metadata is insufficient. |
| 3 | Natural-language log search tool | Too vague and risky for v1; agent-facing explicit filters are more reliable. |
| 4 | Dedicated `count` MCP tool | Duplicates a stronger design where count-only is a `query` mode. |
| 5 | Dedicated `aggregate` MCP tool | Duplicates a stronger design where simple aggregations stay inside `query`. |
| 6 | Protocol-specific reload-analysis tools | Solves the current case quickly but weakens the goal of a general, reusable investigation MCP. |
| 7 | Browser-driven Kibana automation | Fragile and not a durable agent-grade interface compared to a direct MCP query surface. |
| 8 | Dashboard and visualization management | Explicitly outside the handoff’s non-goals. |
| 9 | Saved object editing | Administrative scope creep with no value for runtime investigation. |
| 10 | Live tail or streaming tool | Interesting, but pushes the product away from repeatable investigation toward observability console behavior. |
| 11 | Automatic anomaly detection | Too expensive and speculative relative to the repo’s minimal goal. |
| 12 | Agent-generated report MCP tool | Better handled downstream once evidence retrieval and evidence shaping are solid. |
| 13 | Interactive auth login flow | Not grounded in the stated basic-auth setup and adds avoidable complexity. |
| 14 | Embedded web UI for operators | Not necessary for the MCP to be useful to agents. |
| 15 | Persistent investigation sessions | Adds statefulness before the core query surface proves out. |
| 16 | Automatic environment detection | Nice-to-have, but explicit configuration is safer for staging and production work. |
| 17 | Write-back annotations into Kibana | Mutating external systems is out of scope and high risk. |
| 18 | Result pagination and cursors in v1 | Lower leverage than getting limits, truncation, and clear evidence retrieval right first. |
| 19 | Arbitrary backend passthrough endpoint | Breaks the product boundary and weakens safety. |
| 20 | Separate compare-windows MCP tool | Better expressed as repeated `query` calls with explicit time windows or query modes. |

## Session Log

- 2026-04-02: Initial ideation - 24 candidates generated, 6 survivors kept
- 2026-04-02: Refinement pass - re-ranked around field-aware discovery, multi-mode query, and a flexible two-tool boundary; 7 survivors kept
- 2026-04-02: Re-grounded on ../digital-api/STAGING_TEST_PROTOCOL.md for the logs-investigation aspect; shifted recommendation toward a configured source catalog plus a multi-mode general query tool as the highest-probability simple v1; 6 survivors kept
