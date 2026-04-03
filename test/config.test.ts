import { describe, expect, it } from "vitest";

import { parseAppConfig, resolveSourceCatalogPath } from "../src/config.js";

describe("parseAppConfig", () => {
  it("parses valid environment and source catalog inputs", () => {
    const config = parseAppConfig(
      {
        KIBANA_BASE_URL: "https://kibana.example.com/",
        KIBANA_USERNAME: "elastic",
        KIBANA_PASSWORD: "secret"
      },
      {
        sources: [
          {
            id: "consumer",
            name: "Consumer",
            tags: ["consumer"],
            timeField: "@timestamp",
            backend: {
              kind: "kibana_internal_search_es",
              path: "/internal/search/es",
              index: "consumer-*"
            },
            schema: {
              kind: "kibana_data_views_fields",
              path: "/api/data_views/fields_for_wildcard",
              index: "consumer-*"
            }
          }
        ]
      }
    );

    expect(config.kibana.baseUrl).toBe("https://kibana.example.com");
    expect(config.kibana.timeoutMs).toBe(10000);
    expect(config.sources[0]?.id).toBe("consumer");
    expect(config.sources[0]?.schema?.kind).toBe("kibana_data_views_fields");
  });

  it("accepts schema metadata without an explicit path when the index is provided", () => {
    const config = parseAppConfig(
      {
        KIBANA_BASE_URL: "https://kibana.example.com",
        KIBANA_USERNAME: "elastic",
        KIBANA_PASSWORD: "secret"
      },
      {
        sources: [
          {
            id: "ppr_api_notif_consumers",
            name: "PPR API Notif Consumers",
            tags: ["consumer"],
            timeField: "@timestamp",
            backend: {
              kind: "kibana_internal_search_es",
              path: "/internal/search/es",
              index: "ppr-api-notif-consumers"
            },
            schema: {
              kind: "kibana_data_views_fields",
              index: "ppr-api-notif-consumers"
            }
          }
        ]
      }
    );

    expect(config.sources[0]?.schema?.kind).toBe("kibana_data_views_fields");
    expect(config.sources[0]?.schema?.path).toBeUndefined();
    expect(config.sources[0]?.schema?.index).toBe("ppr-api-notif-consumers");
  });

  it("rejects missing credentials", () => {
    expect(() =>
      parseAppConfig(
        {
          KIBANA_BASE_URL: "https://kibana.example.com",
          KIBANA_USERNAME: "",
          KIBANA_PASSWORD: "secret"
        },
        {
          sources: [
            {
              id: "consumer",
              name: "Consumer",
              tags: ["consumer"],
              timeField: "@timestamp",
              backend: {
                kind: "elasticsearch_search",
                path: "/consumer/_search"
              }
            }
          ]
        }
      )
    ).toThrow();
  });

  it("defaults the source catalog path to the runtime file", () => {
    expect(resolveSourceCatalogPath({})).toBe("config/sources.runtime.json");
    expect(
      resolveSourceCatalogPath({
        KIBANA_SOURCE_CATALOG_PATH: "config/custom.json"
      } as NodeJS.ProcessEnv)
    ).toBe("config/custom.json");
  });
});
