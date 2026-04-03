import { describe, expect, it } from "vitest";

import { SchemaCatalog } from "../src/schema_catalog.js";
import { executeFilter, filterInputSchema } from "../src/tools/filter.js";
import { SourceCatalog } from "../src/source_catalog.js";
import type { SourceDefinition, SourceFieldDescriptor } from "../src/types.js";

const source: SourceDefinition = {
  id: "consumer",
  name: "Consumer",
  tags: ["consumer"],
  timeField: "@timestamp",
  backend: {
    kind: "elasticsearch_search",
    path: "/consumer/_search"
  },
  fieldHints: [
    {
      name: "productId",
      aliases: ["product_id"]
    }
  ],
  defaultTextFields: ["message"],
  evidenceFields: ["productId"]
};

const sourceSchema: SourceFieldDescriptor[] = [
  {
    name: "event",
    type: "text",
    searchable: true,
    aggregatable: false,
    subfields: ["event.keyword"],
    preferred_exact_field: "event.keyword"
  },
  {
    name: "event.keyword",
    type: "keyword",
    searchable: true,
    aggregatable: true,
    multi_field_parent: "event",
    subfields: []
  }
];

describe("executeFilter", () => {
  it("bypasses alias resolution for exact field matches", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const result = await executeFilter(
      {
        source_ids: ["consumer"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        field: "product_id",
        value: "123",
        mode: "hits",
        sort: "desc",
        sort_by: "total_duration_ms",
        limit: 10,
        filters: [],
        nested_filters: [],
        extract_nested: false,
        top_hits_size: 1
      },
      new SourceCatalog([source]),
      {
        executeMany: async (sourceQueries) => {
          capturedBody = sourceQueries[0]?.request.body;
          return [
            {
              source,
              rawResponse: {
                hits: {
                  total: { value: 0 },
                  hits: []
                }
              }
            }
          ];
        }
      }
    );

    expect(result.total).toBe(0);
    expect(result.query_echo.filters[0]?.resolved_field).toBe("product_id");
    expect(result.query_echo.sort_by).toBe("total_duration_ms");
    expect(result.query_echo.resolved_sort_by_by_source?.[0]?.resolved_sort_by).toBe(
      "total_duration_ms"
    );
    expect(capturedBody).toMatchObject({
      query: {
        bool: {
          must: [{}, { term: { product_id: "123" } }]
        }
      },
      sort: [{ total_duration_ms: { order: "desc" } }]
    });
  });

  it("rejects sort_by outside hits mode", async () => {
    expect(() =>
      filterInputSchema.parse({
        source_ids: ["consumer"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        field: "product_id",
        value: "123",
        mode: "count",
        sort: "desc",
        sort_by: "total_duration_ms",
        limit: 10,
        filters: [],
        nested_filters: [],
        extract_nested: false,
        top_hits_size: 1
      })
    ).toThrow("sort_by is only supported when mode is 'hits' or 'grouped_top_hits'");
  });

  it("promotes logical text fields to their preferred exact field when schema metadata is available", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const result = await executeFilter(
      {
        source_ids: ["consumer"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        field: "event",
        value: "PRODUCT_OPENING_DATES_REFRESH_PHASES",
        mode: "hits",
        sort: "desc",
        limit: 10,
        filters: [],
        nested_filters: [],
        extract_nested: false,
        top_hits_size: 1
      },
      new SourceCatalog([source]),
      {
        executeMany: async (sourceQueries) => {
          capturedBody = sourceQueries[0]?.request.body;
          return [
            {
              source,
              rawResponse: {
                hits: {
                  total: { value: 0 },
                  hits: []
                }
              }
            }
          ];
        }
      },
      {
        schemaCatalog: new SchemaCatalog({
          describeFields: async () => sourceSchema
        })
      }
    );

    expect(result.query_echo.filters[0]?.resolved_field).toBe("event.keyword");
    expect(result.query_echo.advisories?.[0]?.kind).toBe("preferred_exact_field");
    expect(capturedBody).toMatchObject({
      query: {
        bool: {
          must: [{}, { term: { "event.keyword": "PRODUCT_OPENING_DATES_REFRESH_PHASES" } }]
        }
      }
    });
  });
});
