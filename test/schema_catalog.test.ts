import { describe, expect, it } from "vitest";

import { SchemaCatalog } from "../src/schema_catalog.js";
import type { SourceDefinition, SourceFieldDescriptor } from "../src/types.js";

const source: SourceDefinition = {
  id: "reload-metrics",
  name: "Reload metrics",
  tags: ["metrics"],
  timeField: "@timestamp",
  backend: {
    kind: "kibana_internal_search_es",
    path: "/internal/search/es",
    index: "consumer-*",
  },
  fieldHints: [
    {
      name: "event",
      aliases: ["event_name"],
      description: "Logical event marker",
    },
  ],
  defaultTextFields: ["message"],
  evidenceFields: ["event"],
};

const fieldDescriptors: SourceFieldDescriptor[] = [
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
  {
    name: "slowest_layers.layer",
    type: "keyword",
    searchable: true,
    aggregatable: true,
    nested_path: "slowest_layers",
    subfields: [],
  },
];

describe("SchemaCatalog", () => {
  it("merges field hints with backend field metadata", async () => {
    const catalog = new SchemaCatalog({
      describeFields: async () => fieldDescriptors,
    });

    const result = await catalog.getFields(source);

    expect(result[0]?.aliases).toEqual(["event_name"]);
    expect(result[0]?.description).toBe("Logical event marker");
    expect(result[0]?.preferred_exact_field).toBe("event.keyword");
  });

  it("caches field metadata by source", async () => {
    let callCount = 0;
    const catalog = new SchemaCatalog({
      describeFields: async () => {
        callCount += 1;
        return fieldDescriptors;
      },
    });

    await catalog.getFields(source);
    await catalog.getFields(source);

    expect(callCount).toBe(1);
  });
});
