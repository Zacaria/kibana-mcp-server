import { describe, expect, it } from "vitest";

import { compileQueryPlan } from "../src/query/compiler.js";
import type { SourceDefinition, SourceFieldDescriptor } from "../src/types.js";

const source: SourceDefinition = {
  id: "workflow-metrics",
  name: "Workflow metrics",
  tags: ["metrics"],
  timeField: "@timestamp",
  backend: {
    kind: "kibana_internal_search_es",
    path: "/internal/search/es",
    index: "workflow-*"
  },
  fieldHints: [],
  defaultTextFields: ["message"],
  evidenceFields: ["trace_id", "job_id"]
};

const sourceSchema: SourceFieldDescriptor[] = [
  {
    name: "steps.name",
    type: "text",
    searchable: true,
    aggregatable: false,
    nested_path: "steps",
    subfields: ["steps.name.keyword"],
    preferred_exact_field: "steps.name.keyword"
  },
  {
    name: "steps.name.keyword",
    type: "keyword",
    searchable: true,
    aggregatable: true,
    multi_field_parent: "steps.name",
    nested_path: "steps",
    subfields: []
  }
];

const objectArraySchema: SourceFieldDescriptor[] = [
  {
    name: "steps.name",
    type: "text",
    searchable: true,
    aggregatable: false,
    object_array_path: "steps",
    subfields: ["steps.name.keyword"],
    preferred_exact_field: "steps.name.keyword"
  },
  {
    name: "steps.name.keyword",
    type: "keyword",
    searchable: true,
    aggregatable: true,
    multi_field_parent: "steps.name",
    object_array_path: "steps",
    subfields: []
  },
  {
    name: "steps.duration_ms",
    type: "long",
    searchable: true,
    aggregatable: true,
    object_array_path: "steps",
    subfields: []
  }
];

describe("compileQueryPlan nested filters", () => {
  it("compiles nested filters into a nested query with inner hits", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["workflow-metrics"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "hits",
        nested_filters: [
          {
            path: "steps",
            field: "name",
            value: "CACHE_REFRESH"
          }
        ],
        extract_nested: true,
        limit: 10
      },
      [source],
      {
        sourceSchemas: new Map([["workflow-metrics", sourceSchema]])
      }
    );

    expect(plan.sourceQueries[0]?.resolvedNestedFilters[0]).toMatchObject({
      path: "steps",
      field: "name",
      resolved_field: "steps.name.keyword"
    });
    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      query: {
        bool: {
          must: [
            {},
            {
              nested: {
                path: "steps",
                query: {
                  bool: {
                    must: [
                      {
                        term: {
                          "steps.name.keyword": "CACHE_REFRESH"
                        }
                      }
                    ]
                  }
                },
                inner_hits: {
                  name: "steps"
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
          source_ids: ["workflow-metrics"],
          start_time: "2026-04-02T12:00:00Z",
          end_time: "2026-04-02T12:05:00Z",
          mode: "hits",
          nested_filters: [
            {
              path: "steps",
              field: "name",
              value: "CACHE_REFRESH"
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

  it("falls back to flat filtering for object arrays that are not nested", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["workflow-metrics"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "hits",
        nested_filters: [
          {
            path: "steps",
            field: "name",
            value: "CACHE_REFRESH"
          }
        ],
        extract_nested: false,
        limit: 10
      },
      [source],
      {
        sourceSchemas: new Map([["workflow-metrics", objectArraySchema]])
      }
    );

    expect(plan.sourceQueries[0]?.resolvedNestedFilters[0]).toMatchObject({
      path: "steps",
      field: "name",
      resolved_field: "steps.name.keyword",
      query_strategy: "flat_object_path"
    });
    expect(plan.sourceQueries[0]?.advisories.map((advisory) => advisory.kind)).toContain(
      "non_nested_object_array"
    );
    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      query: {
        bool: {
          must: [
            {},
            {
              term: {
                "steps.name.keyword": "CACHE_REFRESH"
              }
            }
          ]
        }
      }
    });
  });

  it("rejects unsafe multi-clause fallback on object arrays", () => {
    expect(() =>
      compileQueryPlan(
        {
          source_ids: ["workflow-metrics"],
          start_time: "2026-04-02T12:00:00Z",
          end_time: "2026-04-02T12:05:00Z",
          mode: "hits",
          nested_filters: [
            {
              path: "steps",
              field: "name",
              value: "CACHE_REFRESH"
            },
            {
              path: "steps",
              field: "duration_ms",
              value: 42
            }
          ],
          extract_nested: false,
          limit: 10
        },
        [source],
        {
          sourceSchemas: new Map([["workflow-metrics", objectArraySchema]])
        }
      )
    ).toThrow(/array of objects.*multiple nested_filters/i);
  });
});
