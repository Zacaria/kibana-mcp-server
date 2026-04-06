import { describe, expect, it } from "vitest";

import { createApplication } from "../src/server.js";
import type { AppConfig } from "../src/types.js";

const config: AppConfig = {
  kibana: {
    baseUrl: "https://kibana.example.com",
    username: "elastic",
    password: "secret",
    timeoutMs: 1000,
  },
  sources: [
    {
      id: "consumer",
      name: "Consumer",
      tags: ["consumer"],
      timeField: "@timestamp",
      backend: {
        kind: "elasticsearch_search",
        path: "/consumer/_search",
      },
      fieldHints: [],
      defaultTextFields: ["message"],
      evidenceFields: [],
    },
  ],
};

describe("createApplication", () => {
  it("exposes configure, describe_fields, discover, filter, and query handlers", () => {
    const application = createApplication(config, {
      kibanaClient: {
        executeMany: async () => [],
        describeFields: async () => [],
      } as never,
    });

    expect(Object.keys(application.handlers).sort()).toEqual([
      "configure",
      "describe_fields",
      "discover",
      "filter",
      "query",
    ]);
  });

  it("routes queries through the shared schemas", async () => {
    const application = createApplication(config, {
      kibanaClient: {
        executeMany: async () => [
          {
            source: config.sources[0],
            rawResponse: {
              hits: {
                total: { value: 0 },
                hits: [],
              },
            },
          },
        ],
        describeFields: async () => [],
      } as never,
    });

    const result = await application.handlers.query({
      source_ids: ["consumer"],
      start_time: "2026-04-02T12:00:00Z",
      end_time: "2026-04-02T12:05:00Z",
      mode: "hits",
      sort_by: "duration_ms",
      limit: 10,
    });

    expect(result.total).toBe(0);
    expect(result.query_echo.source_ids).toEqual(["consumer"]);
    expect(result.query_echo.sort_by).toBe("duration_ms");
  });

  it("supports runtime configuration from the client", async () => {
    const executeMany = async () => [
      {
        source: {
          id: "consumer",
          name: "Consumer",
          tags: ["consumer"],
          timeField: "@timestamp",
          backend: {
            kind: "elasticsearch_search" as const,
            path: "/consumer/_search",
          },
          fieldHints: [],
          defaultTextFields: ["message"],
          evidenceFields: [],
        },
        rawResponse: {
          hits: {
            total: { value: 0 },
            hits: [],
          },
        },
      },
    ];
    const describeFields = async () => [];

    const application = createApplication(undefined, {
      kibanaClientFactory: () =>
        ({
          executeMany,
          describeFields,
        }) as never,
    });

    expect(() =>
      application.handlers.discover({
        limit: 10,
      }),
    ).toThrow("Server is not configured");

    const configureResult = await application.handlers.configure({
      kibana: {
        baseUrl: "https://kibana.example.com",
        username: "elastic",
        password: "secret",
        timeoutMs: 1000,
      },
      sources: config.sources,
    });

    expect(configureResult.source_count).toBe(1);
    expect(configureResult.persisted).toBe(true);
    const persistedCatalogPath = configureResult.source_catalog_path;
    expect(persistedCatalogPath).toContain("config/sources.runtime.json");

    const discoverResult = application.handlers.discover({
      limit: 10,
    });
    expect(discoverResult.total).toBe(1);

    const queryResult = await application.handlers.query({
      source_ids: ["consumer"],
      start_time: "2026-04-02T12:00:00Z",
      end_time: "2026-04-02T12:05:00Z",
      mode: "hits",
      limit: 10,
    });

    expect(queryResult.total).toBe(0);

    const filterResult = await application.handlers.filter({
      source_ids: ["consumer"],
      start_time: "2026-04-02T12:00:00Z",
      end_time: "2026-04-02T12:05:00Z",
      field: "productId",
      value: "123",
      mode: "hits",
      sort_by: "total_duration_ms",
    });

    expect(filterResult.total).toBe(0);
    expect(filterResult.query_echo.sort_by).toBe("total_duration_ms");

    const describeFieldsResult = await application.handlers.describe_fields({
      source_id: "consumer",
      limit: 20,
    });

    expect(describeFieldsResult.source_id).toBe("consumer");
  });
});
