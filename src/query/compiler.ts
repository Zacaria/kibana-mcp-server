import type {
  CompiledSourceQuery,
  FieldResolutionAdvisory,
  NestedQueryFilter,
  QueryFilter,
  QueryPlan,
  QueryRequest,
  QuerySort,
  ResolvedNestedQueryFilter,
  ResolvedQueryFilter,
  SourceFieldDescriptor,
  SourceDefinition
} from "../types.js";
import { decodeQueryCursor } from "./cursor.js";

interface CompileQueryOptions {
  resolveFieldAliases?: boolean;
  resolvePreferredExactFields?: boolean;
  sourceSchemas?: Map<string, SourceFieldDescriptor[]>;
  sourceSchemaErrors?: Map<string, string>;
}

function findFieldDescriptor(
  fields: SourceFieldDescriptor[],
  requestedField: string
): SourceFieldDescriptor | undefined {
  const normalized = requestedField.toLowerCase();
  return fields.find((field) => field.name.toLowerCase() === normalized);
}

function resolveRequestedFieldAlias(
  source: SourceDefinition,
  requestedField: string,
  options: CompileQueryOptions
): string {
  if (options.resolveFieldAliases === false) {
    return requestedField;
  }

  const normalized = requestedField.toLowerCase();
  const exactMatch = source.fieldHints.find(
    (fieldHint) =>
      fieldHint.name.toLowerCase() === normalized ||
      (fieldHint.aliases ?? []).some((alias) => alias.toLowerCase() === normalized)
  );

  return exactMatch?.name ?? requestedField;
}

function resolveFieldName(
  source: SourceDefinition,
  requestedField: string,
  purpose: FieldResolutionAdvisory["purpose"],
  options: CompileQueryOptions
): { resolvedField: string; advisory?: FieldResolutionAdvisory } {
  const aliasResolvedField = resolveRequestedFieldAlias(source, requestedField, options);
  const sourceSchema = options.sourceSchemas?.get(source.id);

  if (options.resolvePreferredExactFields === false) {
    return { resolvedField: aliasResolvedField };
  }

  if (!sourceSchema) {
    const schemaError = options.sourceSchemaErrors?.get(source.id);

    if (schemaError && purpose === "filter") {
      return {
        resolvedField: aliasResolvedField,
        advisory: {
          kind: "schema_unavailable",
          source_id: source.id,
          purpose,
          requested_field: requestedField,
          resolved_field: aliasResolvedField,
          reason: `Schema-backed exact-field resolution is unavailable for source '${source.id}': ${schemaError}`
        }
      };
    }

    return { resolvedField: aliasResolvedField };
  }

  const requestedDescriptor = findFieldDescriptor(sourceSchema, aliasResolvedField);
  const fallbackKeyword = findFieldDescriptor(sourceSchema, `${aliasResolvedField}.keyword`);
  const preferredExactField =
    requestedDescriptor?.preferred_exact_field ??
    (fallbackKeyword?.aggregatable ? fallbackKeyword.name : undefined);

  if (preferredExactField && preferredExactField !== aliasResolvedField) {
    return {
      resolvedField: preferredExactField,
      advisory: {
        kind: "preferred_exact_field",
        source_id: source.id,
        purpose,
        requested_field: requestedField,
        resolved_field: preferredExactField,
        reason: `Resolved ${aliasResolvedField} to its preferred exact field for ${purpose}`
      }
    };
  }

  return { resolvedField: aliasResolvedField };
}

function compileFilters(
  source: SourceDefinition,
  filters: QueryFilter[],
  options: CompileQueryOptions
): {
  resolvedFilters: ResolvedQueryFilter[];
  advisories: FieldResolutionAdvisory[];
} {
  const resolvedFilters: ResolvedQueryFilter[] = [];
  const advisories: FieldResolutionAdvisory[] = [];

  for (const filter of filters) {
    const { resolvedField, advisory } = resolveFieldName(source, filter.field, "filter", options);
    resolvedFilters.push({
      ...filter,
      resolved_field: resolvedField
    });
    if (advisory) {
      advisories.push(advisory);
    }
  }

  return { resolvedFilters, advisories };
}

function resolveNestedFieldName(
  source: SourceDefinition,
  nestedFilter: NestedQueryFilter,
  options: CompileQueryOptions
): { resolvedField: string; advisory?: FieldResolutionAdvisory } {
  const requestedField = nestedFilter.field.startsWith(`${nestedFilter.path}.`)
    ? nestedFilter.field
    : `${nestedFilter.path}.${nestedFilter.field}`;

  return resolveFieldName(source, requestedField, "filter", options);
}

function compileNestedFilters(
  source: SourceDefinition,
  nestedFilters: NestedQueryFilter[],
  options: CompileQueryOptions
): {
  resolvedNestedFilters: ResolvedNestedQueryFilter[];
  advisories: FieldResolutionAdvisory[];
} {
  const resolvedNestedFilters: ResolvedNestedQueryFilter[] = [];
  const advisories: FieldResolutionAdvisory[] = [];
  const sourceSchema = options.sourceSchemas?.get(source.id);

  if (nestedFilters.length === 0) {
    return { resolvedNestedFilters, advisories };
  }

  if (!sourceSchema) {
    const schemaError =
      options.sourceSchemaErrors?.get(source.id) ??
      "schema metadata is unavailable for this source";
    throw new Error(
      `Nested filters require schema metadata for source '${source.id}': ${schemaError}`
    );
  }

  for (const nestedFilter of nestedFilters) {
    const nestedPathExists = sourceSchema.some(
      (field) => field.nested_path === nestedFilter.path
    );

    if (!nestedPathExists) {
      throw new Error(
        `Nested path '${nestedFilter.path}' is not known as nested for source '${source.id}'`
      );
    }

    const requestedField = nestedFilter.field.startsWith(`${nestedFilter.path}.`)
      ? nestedFilter.field
      : `${nestedFilter.path}.${nestedFilter.field}`;
    const nestedFieldExists = sourceSchema.some(
      (field) =>
        field.name === requestedField || field.name.startsWith(`${requestedField}.`)
    );

    if (!nestedFieldExists) {
      throw new Error(
        `Nested field '${nestedFilter.field}' was not found under path '${nestedFilter.path}' for source '${source.id}'`
      );
    }

    const { resolvedField, advisory } = resolveNestedFieldName(source, nestedFilter, options);
    resolvedNestedFilters.push({
      ...nestedFilter,
      resolved_field: resolvedField
    });
    if (advisory) {
      advisories.push(advisory);
    }
  }

  return { resolvedNestedFilters, advisories };
}

function buildElasticBody(
  source: SourceDefinition,
  request: Required<Pick<QueryRequest, "start_time" | "end_time">> &
    Pick<
      QueryRequest,
      "text" | "group_by" | "histogram_interval" | "sort_by" | "extract_nested" | "cursor" | "stats_field" | "top_hits_size"
    > & {
      mode: NonNullable<QueryRequest["mode"]>;
      sort: QuerySort;
      limit: number;
    },
  resolvedFilters: ResolvedQueryFilter[],
  resolvedNestedFilters: ResolvedNestedQueryFilter[],
  resolvedSortBy: string,
  options: CompileQueryOptions
): Record<string, unknown> {
  const must: Record<string, unknown>[] = [
    {
      range: {
        [source.timeField]: {
          gte: request.start_time,
          lte: request.end_time
        }
      }
    }
  ];

  if (request.text) {
    must.push({
      simple_query_string: {
        query: request.text,
        ...(source.defaultTextFields.length > 0 ? { fields: source.defaultTextFields } : {})
      }
    });
  }

  for (const filter of resolvedFilters) {
    must.push({
      term: {
        [filter.resolved_field]: filter.value
      }
    });
  }

  if (resolvedNestedFilters.length > 0) {
    const filtersByPath = new Map<string, ResolvedNestedQueryFilter[]>();
    for (const nestedFilter of resolvedNestedFilters) {
      const filters = filtersByPath.get(nestedFilter.path) ?? [];
      filters.push(nestedFilter);
      filtersByPath.set(nestedFilter.path, filters);
    }

    for (const [path, nestedFilters] of filtersByPath.entries()) {
      must.push({
        nested: {
          path,
          query: {
            bool: {
              must: nestedFilters.map((nestedFilter) => ({
                term: {
                  [nestedFilter.resolved_field]: nestedFilter.value
                }
              }))
            }
          },
          ...(request.extract_nested
            ? {
                inner_hits: {
                  name: path,
                  size: request.limit
                }
              }
            : {})
        }
      });
    }
  }

  const baseBody: Record<string, unknown> = {
    query: {
      bool: { must }
    },
    track_total_hits: true
  };

  if (request.mode === "hits") {
    const cursor = request.cursor ? decodeQueryCursor(request.cursor) : undefined;
    return {
      ...baseBody,
      size: request.limit,
      sort: [{ [resolvedSortBy]: { order: request.sort } }],
      ...(cursor ? { search_after: cursor.values } : {})
    };
  }

  if (request.mode === "count") {
    return {
      ...baseBody,
      size: 0
    };
  }

  if (request.mode === "histogram") {
    return {
      ...baseBody,
      size: 0,
      aggs: {
        histogram: {
          date_histogram: {
            field: source.timeField,
            fixed_interval: request.histogram_interval ?? "1m"
          }
        }
      }
    };
  }

  if (request.mode === "stats") {
    if (!request.stats_field) {
      throw new Error("stats_field is required when mode is 'stats'");
    }

    const statsField = resolveRequestedFieldAlias(source, request.stats_field, options);

    if (request.group_by) {
      return {
        ...baseBody,
        size: 0,
        aggs: {
          groups: {
            terms: {
              field: resolveFieldName(source, request.group_by, "group_by", options).resolvedField,
              size: request.limit
            },
            aggs: {
              stats_summary: {
                stats: {
                  field: statsField
                }
              },
              stats_percentiles: {
                percentiles: {
                  field: statsField,
                  percents: [50, 95, 99]
                }
              }
            }
          }
        }
      };
    }

    return {
      ...baseBody,
      size: 0,
      aggs: {
        stats_summary: {
          stats: {
            field: statsField
          }
        },
        stats_percentiles: {
          percentiles: {
            field: statsField,
            percents: [50, 95, 99]
          }
        }
      }
    };
  }

  if (request.mode === "grouped_top_hits") {
    if (!request.group_by) {
      throw new Error("group_by is required when mode is 'grouped_top_hits'");
    }

    return {
      ...baseBody,
      size: 0,
      aggs: {
        groups: {
          terms: {
            field: resolveFieldName(source, request.group_by, "group_by", options).resolvedField,
            size: request.limit
          },
          aggs: {
            top_hits: {
              top_hits: {
                size: request.top_hits_size ?? 1,
                sort: [{ [resolvedSortBy]: { order: request.sort } }]
              }
            }
          }
        }
      }
    };
  }

  if (!request.group_by) {
    throw new Error("group_by is required when mode is 'terms'");
  }

  return {
    ...baseBody,
    size: 0,
    aggs: {
      groups: {
        terms: {
          field: resolveFieldName(source, request.group_by, "group_by", options).resolvedField,
          size: request.limit
        }
      }
    }
  };
}

function compileSourceQuery(
  source: SourceDefinition,
  request: QueryRequest & { mode: NonNullable<QueryRequest["mode"]>; sort: QuerySort; limit: number },
  options: CompileQueryOptions
): CompiledSourceQuery {
  const { resolvedFilters, advisories } = compileFilters(source, request.filters ?? [], options);
  const nestedCompilation = compileNestedFilters(source, request.nested_filters ?? [], options);
  advisories.push(...nestedCompilation.advisories);
  const sortResolution = resolveFieldName(
    source,
    request.sort_by ?? source.timeField,
    "sort",
    options
  );
  const resolvedSortBy = sortResolution.resolvedField;

  if (sortResolution.advisory && request.sort_by) {
    advisories.push(sortResolution.advisory);
  }

  return {
    source,
    resolvedFilters,
    resolvedNestedFilters: nestedCompilation.resolvedNestedFilters,
    resolvedSortBy,
    advisories,
    request: {
      body: buildElasticBody(
        source,
        request,
        resolvedFilters,
        nestedCompilation.resolvedNestedFilters,
        resolvedSortBy,
        options
      )
    }
  };
}

export function compileQueryPlan(
  request: QueryRequest,
  sources: SourceDefinition[],
  options: CompileQueryOptions = {}
): QueryPlan {
  const mode = request.mode ?? "hits";
  const sort = request.sort ?? "desc";
  const limit = request.limit ?? (mode === "count" ? 1 : 100);

  const sourceQueries = sources.map((source) =>
    compileSourceQuery(source, {
      ...request,
      mode,
      sort,
      limit
    }, options)
  );

  return {
    mode,
    startTime: request.start_time,
    endTime: request.end_time,
    sort,
    sortBy: request.sort_by,
    cursor: request.cursor,
    limit,
    text: request.text,
    nestedFilters: sourceQueries.flatMap((sourceQuery) => sourceQuery.resolvedNestedFilters),
    statsField: request.stats_field,
    topHitsSize: request.top_hits_size,
    histogramInterval: request.histogram_interval,
    groupBy: request.group_by,
    sourceIds: sources.map((source) => source.id),
    sourceQueries
  };
}
