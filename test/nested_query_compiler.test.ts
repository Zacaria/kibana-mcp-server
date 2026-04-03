import { describe, expect, it } from "vitest";

import { compileQueryPlan } from "../src/query/compiler.js";
import type { SourceDefinition, SourceFieldDescriptor } from "../src/types.js";

const source: SourceDefinition = {
  id: "reload-metrics",
  name: "Reload metrics",
  tags: ["metrics"],
  timeField: "@timestamp",
  backend: {
    kind: "kibana_internal_search_es",
    path: "/internal/search/es",
    index: "consumer-*"
  },
  fieldHints: [],
  defaultTextFields: ["message"],
  evidenceFields: ["request_id", "product_id"]
};

const sourceSchema: SourceFieldDescriptor[] = [
  {
    name: "slowest_layers.layer",
    type: "text",
    searchable: true,
    aggregatable: false,
    nested_path: "slowest_layers",
    subfields: ["slowest_layers.layer.keyword"],
    preferred_exact_field: "slowest_layers.layer.keyword"
  },
  {
    name: "slowest_layers.layer.keyword",
    type: "keyword",
    searchable: true,
    aggregatable: true,
    multi_field_parent: "slowest_layers.layer",
    nested_path: "slowest_layers",
    subfields: []
  }
];

describe("compileQueryPlan nested filters", () => {
  it("compiles nested filters into a nested query with inner hits", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["reload-metrics"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "hits",
        nested_filters: [
          {
            path: "slowest_layers",
            field: "layer",
            value: "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3"
          }
        ],
        extract_nested: true,
        limit: 10
      },
      [source],
      {
        sourceSchemas: new Map([["reload-metrics", sourceSchema]])
      }
    );

    expect(plan.sourceQueries[0]?.resolvedNestedFilters[0]).toMatchObject({
      path: "slowest_layers",
      field: "layer",
      resolved_field: "slowest_layers.layer.keyword"
    });
    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      query: {
        bool: {
          must: [
            {},
            {
              nested: {
                path: "slowest_layers",
                query: {
                  bool: {
                    must: [
                      {
                        term: {
                          "slowest_layers.layer.keyword":
                            "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3"
                        }
                      }
                    ]
                  }
                },
                inner_hits: {
                  name: "slowest_layers"
                }
              }
            }
          ]
        }
      }
    });
  });

  it("fails early when nested schema metadata is unavailable", () => {
    expect(() =>
      compileQueryPlan(
        {
          source_ids: ["reload-metrics"],
          start_time: "2026-04-02T12:00:00Z",
          end_time: "2026-04-02T12:05:00Z",
          mode: "hits",
          nested_filters: [
            {
              path: "slowest_layers",
              field: "layer",
              value: "MEMOIZE_V3:PRODUCT_OPENING_DATES_V3"
            }
          ],
          extract_nested: true,
          limit: 10
        },
        [source],
        {
          sourceSchemaErrors: new Map([["reload-metrics", "schema backend returned 404 Not Found"]])
        }
      )
    ).toThrow("Nested filters require schema metadata");
  });
});
