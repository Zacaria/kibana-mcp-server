---
title: Support Policy
status: active
updated: 2026-04-06
---

# Support Policy

## Audience

This MCP is designed for operators and AI agents that need read-only access to Kibana-backed logs for investigation workflows.

## Guaranteed Support

- Node.js 22+ runtime
- Repo-local Codex plugin install
- `kibana_internal_search_es` and `elasticsearch_search` backends
- Runtime configuration via `configure` plus persisted non-secret source catalogs

## Best-Effort Support

- Schema metadata endpoints (`kibana_data_views_fields`, `kibana_index_patterns_fields`, `elasticsearch_field_caps`)
- Nested query features that depend on schema availability
- Public package installs (once enabled)

Best-effort means we will investigate issues but cannot guarantee behavior across all deployments.

## Known Environment Constraints

- Some Kibana deployments proxy or block schema metadata endpoints. In those cases, schema-aware features may be unavailable.
- Credentials must remain in environment variables. The server does not persist secrets to disk.

## Security Reporting

If you find a security issue, report it through the process documented in `SECURITY.md`.

## Response Expectations

- Critical security reports: acknowledge within 3 business days.
- Non-security issues: response cadence depends on maintainer availability.

## Out of Scope

- Writes to Kibana, Elasticsearch, or data views
- Workflow-specific automation beyond log investigation
