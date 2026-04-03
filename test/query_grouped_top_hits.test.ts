import { describe, expect, it } from "vitest";

import { compileQueryPlan } from "../src/query/compiler.js";
import { normalizeQueryResponse } from "../src/query/normalize.js";
import type { KibanaSearchExecutionResult, SourceDefinition } from "../src/types.js";

const source: SourceDefinition = {
  id: "reload-metrics",
  name: "Reload metrics",
  tags: ["metrics"],
  timeField: "@timestamp",
  backend: {
    kind: "elasticsearch_search",
    path: "/metrics/_search"
  },
  fieldHints: [],
  defaultTextFields: ["message"],
  evidenceFields: ["request_id", "total_duration_ms"]
};

describe("query grouped_top_hits mode", () => {
  it("compiles grouped top-hits aggregations", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["reload-metrics"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "grouped_top_hits",
        group_by: "request_id",
        sort_by: "total_duration_ms",
        top_hits_size: 1,
        limit: 5
      },
      [source]
    );

    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      aggs: {
        groups: {
          terms: {
            field: "request_id",
            size: 5
          },
          aggs: {
            top_hits: {
              top_hits: {
                size: 1,
                sort: [{ total_duration_ms: { order: "desc" } }]
              }
            }
          }
        }
      }
    });
  });

  it("normalizes grouped top-hit responses", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["reload-metrics"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "grouped_top_hits",
        group_by: "request_id",
        sort_by: "total_duration_ms",
        top_hits_size: 1,
        limit: 5
      },
      [source]
    );

    const execution: KibanaSearchExecutionResult = {
      source,
      rawResponse: {
        aggregations: {
          groups: {
            buckets: [
              {
                key: "req-1",
                doc_count: 2,
                top_hits: {
                  hits: {
                    hits: [
                      {
                        _id: "doc-1",
                        _index: "metrics-2026.04.02",
                        _source: {
                          "@timestamp": "2026-04-02T12:01:00Z",
                          request_id: "req-1",
                          message: "reload stats",
                          total_duration_ms: 400
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      }
    };

    const result = normalizeQueryResponse(plan, [execution]);

    expect(result.grouped_hits?.[0]?.buckets[0]?.key).toBe("req-1");
    expect(result.grouped_hits?.[0]?.buckets[0]?.hits[0]?.document_id).toBe("doc-1");
  });
});
