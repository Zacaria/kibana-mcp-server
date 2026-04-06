import { describe, expect, it } from "vitest";

import { compileQueryPlan } from "../src/query/compiler.js";
import type { SourceDefinition, SourceFieldDescriptor } from "../src/types.js";

const source: SourceDefinition = {
  id: "app-logs",
  name: "Application logs",
  tags: ["application"],
  timeField: "@timestamp",
  backend: {
    kind: "kibana_internal_search_es",
    path: "/internal/search/es",
    index: "app-logs-*",
  },
  fieldHints: [
    {
      name: "traceId",
      aliases: ["trace_id"],
    },
  ],
  defaultTextFields: ["message"],
  evidenceFields: ["traceId"],
};

const sourceSchema: SourceFieldDescriptor[] = [
  {
    name: "event",
    type: "text",
    searchable: true,
    aggregatable: false,
    subfields: ["event.keyword"],
    preferred_exact_field: "event.keyword",
  },
  {
    name: "event.keyword",
    type: "keyword",
    searchable: true,
    aggregatable: true,
    multi_field_parent: "event",
    subfields: [],
  },
];

describe("compileQueryPlan", () => {
  it("compiles a hits query with resolved field aliases", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["app-logs"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        text: "workflow",
        filters: [{ field: "trace_id", value: "trace-123" }],
        mode: "hits",
        sort_by: "trace_id",
        limit: 25,
      },
      [source],
    );

    expect(plan.mode).toBe("hits");
    expect(plan.sourceQueries[0]?.resolvedFilters[0]?.resolved_field).toBe("traceId");
    expect(plan.sourceQueries[0]?.resolvedSortBy).toBe("traceId");
    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      size: 25,
      sort: [{ traceId: { order: "desc" } }],
    });
  });

  it("compiles terms aggregations", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["app-logs"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "terms",
        group_by: "trace_id",
        limit: 5,
      },
      [source],
    );

    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      aggs: {
        groups: {
          terms: {
            field: "traceId",
            size: 5,
          },
        },
      },
    });
  });

  it("preserves exact field names when alias resolution is disabled", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["app-logs"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        filters: [{ field: "trace_id", value: "trace-123" }],
        mode: "hits",
        limit: 25,
      },
      [source],
      {
        resolveFieldAliases: false,
      },
    );

    expect(plan.sourceQueries[0]?.resolvedFilters[0]?.resolved_field).toBe("trace_id");
    expect(plan.sourceQueries[0]?.resolvedSortBy).toBe("@timestamp");
  });

  it("prefers keyword-safe exact fields in query mode when schema metadata is available", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["app-logs"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        filters: [{ field: "event", value: "CACHE_REFRESH_PHASES" }],
        mode: "hits",
        limit: 25,
      },
      [source],
      {
        sourceSchemas: new Map([["app-logs", sourceSchema]]),
      },
    );

    expect(plan.sourceQueries[0]?.resolvedFilters[0]?.resolved_field).toBe("event.keyword");
    expect(plan.sourceQueries[0]?.advisories[0]?.requested_field).toBe("event");
    expect(plan.sourceQueries[0]?.advisories[0]?.resolved_field).toBe("event.keyword");
  });

  it("warns when schema-backed exact-field resolution is unavailable", () => {
    const plan = compileQueryPlan(
      {
        source_ids: ["app-logs"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        filters: [{ field: "event", value: "CACHE_REFRESH_PHASES" }],
        mode: "hits",
        limit: 25,
      },
      [source],
      {
        sourceSchemaErrors: new Map([["app-logs", "schema backend returned 404 Not Found"]]),
      },
    );

    expect(plan.sourceQueries[0]?.resolvedFilters[0]?.resolved_field).toBe("event");
    expect(plan.sourceQueries[0]?.advisories[0]?.kind).toBe("schema_unavailable");
  });

  it("applies search_after values when a cursor is provided", () => {
    const cursor = Buffer.from(
      JSON.stringify({
        source_id: "app-logs",
        sort: "desc",
        sort_by: "traceId",
        values: ["trace-123"],
      }),
      "utf8",
    ).toString("base64url");

    const plan = compileQueryPlan(
      {
        source_ids: ["app-logs"],
        start_time: "2026-04-02T12:00:00Z",
        end_time: "2026-04-02T12:05:00Z",
        mode: "hits",
        cursor,
        limit: 25,
      },
      [source],
    );

    expect(plan.sourceQueries[0]?.request.body).toMatchObject({
      search_after: ["trace-123"],
    });
  });
});
