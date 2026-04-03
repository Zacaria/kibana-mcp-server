import { describe, expect, it } from "vitest";

import { normalizeQueryResponse } from "../src/query/normalize.js";
import type { KibanaSearchExecutionResult, QueryPlan, SourceDefinition } from "../src/types.js";

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
  evidenceFields: ["request_id", "product_id"]
};

describe("normalizeQueryResponse nested matches", () => {
  it("extracts matching nested objects from inner hits", () => {
    const plan: QueryPlan = {
      mode: "hits",
      startTime: "2026-04-02T12:00:00Z",
      endTime: "2026-04-02T12:05:00Z",
      sort: "desc",
      limit: 10,
      sourceIds: ["reload-metrics"],
      sourceQueries: [
        {
          source,
          resolvedFilters: [],
          resolvedNestedFilters: [
            {
              path: "slowest_layers",
              field: "layer",
              resolved_field: "slowest_layers.layer.keyword",
              value: "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3"
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
                request_id: "req-1",
                product_id: "product-1",
                message: "reload stats"
              },
              inner_hits: {
                slowest_layers: {
                  hits: {
                    hits: [
                      {
                        _source: {
                          layer: "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3",
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

    expect(result.hits?.[0]?.nested_matches?.[0]?.path).toBe("slowest_layers");
    expect(result.hits?.[0]?.nested_matches?.[0]?.documents[0]).toMatchObject({
      layer: "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3",
      duration_ms: 1234
    });
  });
});
