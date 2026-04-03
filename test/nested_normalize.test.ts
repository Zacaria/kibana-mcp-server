import { describe, expect, it } from "vitest";

import { normalizeQueryResponse } from "../src/query/normalize.js";
import type { KibanaSearchExecutionResult, QueryPlan, SourceDefinition } from "../src/types.js";

const source: SourceDefinition = {
  id: "workflow-metrics",
  name: "Workflow metrics",
  tags: ["metrics"],
  timeField: "@timestamp",
  backend: {
    kind: "elasticsearch_search",
    path: "/metrics/_search"
  },
  fieldHints: [],
  defaultTextFields: ["message"],
  evidenceFields: ["trace_id", "job_id"]
};

describe("normalizeQueryResponse nested matches", () => {
  it("extracts matching nested objects from inner hits", () => {
    const plan: QueryPlan = {
      mode: "hits",
      startTime: "2026-04-02T12:00:00Z",
      endTime: "2026-04-02T12:05:00Z",
      sort: "desc",
      limit: 10,
      sourceIds: ["workflow-metrics"],
      sourceQueries: [
        {
          source,
          resolvedFilters: [],
          resolvedNestedFilters: [
            {
              path: "steps",
              field: "name",
              resolved_field: "steps.name.keyword",
              value: "CACHE_REFRESH"
            }
          ],
          resolvedSortBy: "@timestamp",
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
              _index: "metrics-2026.04.02",
              _source: {
                "@timestamp": "2026-04-02T12:01:00Z",
                trace_id: "trace-1",
                job_id: "job-1",
                message: "workflow stats"
              },
              inner_hits: {
                steps: {
                  hits: {
                    hits: [
                      {
                        _source: {
                          name: "CACHE_REFRESH",
                          duration_ms: 1234,
                          keys_scanned: 0
                        }
                      }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    };

    const result = normalizeQueryResponse(plan, [execution]);

    expect(result.hits?.[0]?.nested_matches?.[0]?.path).toBe("steps");
    expect(result.hits?.[0]?.nested_matches?.[0]?.documents[0]).toMatchObject({
      name: "CACHE_REFRESH",
      duration_ms: 1234
    });
  });
});
