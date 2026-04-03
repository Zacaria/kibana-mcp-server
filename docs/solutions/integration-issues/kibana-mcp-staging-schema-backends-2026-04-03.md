---
title: Staging Kibana schema backends all return 404 behind /logs
date: 2026-04-03
category: integration-issues
module: kibana-mcp-server
problem_type: integration_issue
component: tooling
symptoms:
  - `describe_fields` returned `404 Not Found` for `kibana_data_views_fields`
  - `describe_fields` returned `404 Not Found` for `kibana_index_patterns_fields`
  - `describe_fields` returned `404 Not Found` for `elasticsearch_field_caps`
  - nested queries stayed blocked because schema metadata could not be loaded
root_cause: environment_mismatch
resolution_type: guidance
severity: medium
tags: [mcp, kibana, staging, schema, 404]
---

# Staging Kibana schema backends all return 404 behind `/logs`

## Problem

The Kibana MCP can expose schema-aware features only when the configured source has a working schema backend. Against staging at `https://api.staging.clubmed.com/logs`, all supported schema backend kinds currently return `404`, which makes `describe_fields` unusable and blocks schema-dependent query validation.

## Observed Attempts

Live checks were run with the current staging base URL and a consumer-style log source:

- `kibana_data_views_fields` with `/api/data_views/fields_for_wildcard`
- `kibana_index_patterns_fields` with `/api/index_patterns/_fields_for_wildcard`
- `elasticsearch_field_caps` with `/<index>/_field_caps`

All three returned `404 Not Found`.

## What Works

The search backend itself still works through Kibana internal search:

- `backend.kind = kibana_internal_search_es`
- `backend.path = /internal/search/es`

So source discovery and log querying remain usable even when schema metadata is absent.

## Recommended Staging Guidance

For the current staging endpoint:

- leave `schema` unset on sources unless a working metadata endpoint is explicitly confirmed
- rely on `discover`, `filter`, and `query` for log investigation
- treat `describe_fields`, exact-safe field promotion, and nested-field validation as unavailable until a schema backend starts returning data

## Verification Checklist

Before re-enabling schema-dependent behavior in staging, confirm one of the following works end to end:

- Kibana data views field metadata endpoint
- Kibana legacy index patterns field metadata endpoint
- direct Elasticsearch field capabilities endpoint

If none respond, schema-aware features should remain disabled for that staging source.
