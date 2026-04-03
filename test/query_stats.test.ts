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
  evidenceFields: ["request_id"]
};

describe("query stats mode", () => {
  it("compiles numeric stats aggregations with percentiles", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["reload-metrics"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "stats",
        stats_field: "total_duration_ms"
      },
      [source]
    );

    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      aggs: {
        stats_summary: {
          stats: {
            field: "total_duration_ms"
          }
        },
        stats_percentiles: {
          percentiles: {
            field: "total_duration_ms",
            percents: [50, 95, 99]
          }
        }
      }
    });
  });

  it("normalizes stats responses", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["reload-metrics"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "stats",
        stats_field: "total_duration_ms"
      },
      [source]
    );

    const execution: KibanaSearchExecutionResult = {
      source,
      rawResponse: {
        aggregations: {
          stats_summary: {
            count: 3,
            min: 10,
            max: 40,
            avg: 20,
            sum: 60
          },
          stats_percentiles: {
            values: {
              "50.0": 20,
              "95.0": 39,
              "99.0": 40
            }
          }
        }
      }
    };

    const result = normalizeQueryResponse(plan, [execution]);

    expect(result.stats?.[0]).toMatchObject({
      source_id: "reload-metrics",
      field: "total_duration_ms",
      summary: {
        count: 3,
        min: 10,
        max: 40,
        avg: 20,
        sum: 60,
        p50: 20,
        p95: 39,
        p99: 40
      }
    });
  });
});
