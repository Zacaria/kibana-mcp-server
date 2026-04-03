import { describe, expect, it } from "vitest";

import { normalizeQueryResponse } from "../src/query/normalize.js";
import type { KibanaSearchExecutionResult, QueryPlan, SourceDefinition } from "../src/types.js";

const source: SourceDefinition = {
  id: "app-logs",
  name: "Application logs",
  tags: ["application"],
  timeField: "@timestamp",
  backend: {
    kind: "elasticsearch_search",
    path: "/app-logs/_search"
  },
  fieldHints: [],
  defaultTextFields: ["message"],
  evidenceFields: ["traceId"]
};

describe("normalizeQueryResponse", () => {
  it("normalizes hits responses", () => {
    const plan: QueryPlan = {
      mode: "hits",
      startTime: "2026-04-02T12:00:00Z",
      endTime: "2026-04-02T12:05:00Z",
      sort: "desc",
      sortBy: "duration_ms",
      limit: 10,
      sourceIds: ["app-logs"],
      sourceQueries: [
        {
          source,
          resolvedFilters: [
            { field: "traceId", resolved_field: "traceId", value: "trace-123" }
          ],
          resolvedNestedFilters: [],
          resolvedSortBy: "duration_ms",
          advisories: [],
          request: { body: {} }
        }
      ]
    };

    const execution: KibanaSearchExecutionResult = {
      source,
      rawResponse: {
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "doc-1",
              _index: "app-logs-2026.04.02",
              _source: {
                "@timestamp": "2026-04-02T12:01:00Z",
                message: "workflow completed",
                traceId: "trace-123",
                duration_ms: 42
              }
            }
          ]
        }
      }
    };

    const result = normalizeQueryResponse(plan, [execution]);
    expect(result.total).toBe(1);
    expect(result.hits?.[0]?.summary).toContain("workflow completed");
    expect(result.hits?.[0]?.selected_fields.traceId).toBe("trace-123");
    expect(result.query_echo.sort_by).toBe("duration_ms");
    expect(result.query_echo.resolved_sort_by_by_source?.[0]?.resolved_sort_by).toBe("duration_ms");
  });

  it("normalizes grouped counts", () => {
    const plan: QueryPlan = {
      mode: "terms",
      startTime: "2026-04-02T12:00:00Z",
      endTime: "2026-04-02T12:05:00Z",
      sort: "desc",
      limit: 5,
      groupBy: "step",
      sourceIds: ["app-logs"],
      sourceQueries: [
        {
          source,
          resolvedFilters: [],
          resolvedNestedFilters: [],
          resolvedSortBy: "@timestamp",
          advisories: [],
          request: { body: {} }
        }
      ]
    };

    const result = normalizeQueryResponse(plan, [
      {
        source,
        rawResponse: {
          aggregations: {
            groups: {
              buckets: [
                { key: "CACHE_REFRESH", doc_count: 2 }
              ]
            }
          }
        }
      }
    ]);
    expect(result.groups?.[0]?.buckets[0]?.key).toBe("CACHE_REFRESH");
  });

  it("globally sorts and truncates multi-source hits by the requested sort field", () => {
    const apiSource: SourceDefinition = {
      ...source,
      id: "api",
      name: "API logs"
    };

    const plan: QueryPlan = {
      mode: "hits",
      startTime: "2026-04-02T12:00:00Z",
      endTime: "2026-04-02T12:05:00Z",
      sort: "desc",
      sortBy: "total_duration_ms",
      limit: 2,
      sourceIds: ["app-logs", "api"],
      sourceQueries: [
        {
          source,
          resolvedFilters: [],
          resolvedNestedFilters: [],
          resolvedSortBy: "total_duration_ms",
          advisories: [],
          request: { body: {} }
        },
        {
          source: apiSource,
          resolvedFilters: [],
          resolvedNestedFilters: [],
          resolvedSortBy: "total_duration_ms",
          advisories: [],
          request: { body: {} }
        }
      ]
    };

    const result = normalizeQueryResponse(plan, [
      {
        source,
        rawResponse: {
          hits: {
            total: { value: 2 },
            hits: [
              {
                _id: "app-1",
                _index: "app-logs-2026.04.02",
                _source: {
                  "@timestamp": "2026-04-02T12:01:00Z",
                  message: "application slow",
                  total_duration_ms: 200
                }
              },
              {
                _id: "app-2",
                _index: "app-logs-2026.04.02",
                _source: {
                  "@timestamp": "2026-04-02T12:02:00Z",
                  message: "application medium",
                  total_duration_ms: 150
                }
              }
            ]
          }
        }
      },
      {
        source: apiSource,
        rawResponse: {
          hits: {
            total: { value: 1 },
            hits: [
              {
                _id: "api-1",
                _index: "api-2026.04.02",
                _source: {
                  "@timestamp": "2026-04-02T12:03:00Z",
                  message: "api slowest",
                  total_duration_ms: 300
                }
              }
            ]
          }
        }
      }
    ]);

    expect(result.hits?.map((hit) => hit.document_id)).toEqual(["api-1", "app-1"]);
    expect(result.query_echo.truncated).toBe(true);
  });

  it("returns a next cursor for single-source hit pagination when sort values are available", () => {
    const plan: QueryPlan = {
      mode: "hits",
      startTime: "2026-04-02T12:00:00Z",
      endTime: "2026-04-02T12:05:00Z",
      sort: "desc",
      sortBy: "duration_ms",
      limit: 1,
      sourceIds: ["app-logs"],
      sourceQueries: [
        {
          source,
          resolvedFilters: [],
          resolvedNestedFilters: [],
          resolvedSortBy: "duration_ms",
          advisories: [],
          request: { body: {} }
        }
      ]
    };

    const result = normalizeQueryResponse(plan, [
      {
        source,
        rawResponse: {
          hits: {
            total: { value: 2 },
            hits: [
              {
                _id: "doc-1",
                _index: "app-logs-2026.04.02",
                sort: [42],
                _source: {
                  "@timestamp": "2026-04-02T12:01:00Z",
                  message: "workflow completed",
                  duration_ms: 42
                }
              }
            ]
          }
        }
      }
    ]);

    expect(result.next_cursor).toBeDefined();
  });
});
