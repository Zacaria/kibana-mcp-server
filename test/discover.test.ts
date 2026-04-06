import { describe, expect, it } from "vitest";

import { SourceCatalog } from "../src/source_catalog.js";
import { executeDiscover, formatDiscoverResult } from "../src/tools/discover.js";

const catalog = new SourceCatalog([
  {
    id: "consumer",
    name: "Consumer cache logs",
    tags: ["consumer"],
    timeField: "@timestamp",
    backend: {
      kind: "kibana_internal_search_es",
      path: "/internal/search/es",
      index: "consumer-*",
    },
    fieldHints: [{ name: "requestId", aliases: ["request_id"] }],
    defaultTextFields: ["message"],
    evidenceFields: ["requestId"],
  },
]);

describe("executeDiscover", () => {
  it("returns matching sources with field hints", () => {
    const result = executeDiscover({ query: "consumer", limit: 10 }, catalog);
    expect(result.total).toBe(1);
    expect(result.sources[0]?.field_hints[0]?.name).toBe("requestId");
  });

  it("formats a concise text summary", () => {
    const result = executeDiscover({ limit: 10 }, catalog);
    expect(formatDiscoverResult(result)).toContain("consumer");
    expect(formatDiscoverResult(result)).toContain("requestId");
  });
});
