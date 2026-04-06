import type {
  HistogramBucket,
  KibanaSearchExecutionResult,
  NormalizedHit,
  QueryPlan,
  QueryStructuredResponse,
  TermsBucket,
} from "../types.js";
import { encodeQueryCursor } from "./cursor.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractTotal(rawResponse: Record<string, unknown>): number {
  const hits = asRecord(rawResponse.hits);
  const total = hits.total;

  if (typeof total === "number") {
    return total;
  }

  if (total && typeof total === "object") {
    const totalValue = (total as Record<string, unknown>).value;
    return typeof totalValue === "number" ? totalValue : 0;
  }

  return 0;
}

function extractSummary(rawDocument: Record<string, unknown>, defaultTextFields: string[]): string {
  for (const field of [...defaultTextFields, "message", "log", "event.original"]) {
    const candidate = rawDocument[field];
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate;
    }
  }

  return JSON.stringify(rawDocument).slice(0, 240);
}

function extractSelectedFields(
  rawDocument: Record<string, unknown>,
  evidenceFields: string[],
): Record<string, unknown> {
  return evidenceFields.reduce<Record<string, unknown>>((selected, fieldName) => {
    if (fieldName in rawDocument) {
      selected[fieldName] = rawDocument[fieldName];
    }
    return selected;
  }, {});
}

function extractNestedMatches(hitRecord: Record<string, unknown>) {
  const innerHits = asRecord(hitRecord.inner_hits);

  return Object.entries(innerHits)
    .map(([path, nestedHitEnvelope]) => {
      const hits = asArray(asRecord(asRecord(nestedHitEnvelope).hits).hits);
      const documents = hits.map((nestedHit) => asRecord(asRecord(nestedHit)._source));

      if (documents.length === 0) {
        return null;
      }

      return {
        path,
        documents,
      };
    })
    .filter(
      (
        nestedMatch,
      ): nestedMatch is {
        path: string;
        documents: Record<string, unknown>[];
      } => nestedMatch !== null,
    );
}

function normalizeHits(result: KibanaSearchExecutionResult): {
  total: number;
  hits: NormalizedHit[];
} {
  const rawResponse = result.rawResponse;
  const hitsEnvelope = asRecord(rawResponse.hits);
  const rawHits = asArray(hitsEnvelope.hits);
  const normalizedHits = rawHits.map((hit) => normalizeRawHit(result, asRecord(hit)));

  return {
    total: extractTotal(rawResponse),
    hits: normalizedHits,
  };
}

function normalizeRawHit(
  result: KibanaSearchExecutionResult,
  hitRecord: Record<string, unknown>,
): NormalizedHit {
  const rawDocument = asRecord(hitRecord._source);
  const nestedMatches = extractNestedMatches(hitRecord);

  return {
    source_id: result.source.id,
    timestamp:
      typeof rawDocument[result.source.timeField] === "string"
        ? (rawDocument[result.source.timeField] as string)
        : null,
    summary: extractSummary(rawDocument, result.source.defaultTextFields),
    document_id: typeof hitRecord._id === "string" ? hitRecord._id : null,
    index: typeof hitRecord._index === "string" ? hitRecord._index : null,
    selected_fields: extractSelectedFields(rawDocument, result.source.evidenceFields),
    ...(nestedMatches.length > 0
      ? {
          nested_matches: nestedMatches,
        }
      : {}),
    raw_document: rawDocument,
  };
}

function buildNextCursor(
  plan: QueryPlan,
  executions: KibanaSearchExecutionResult[],
  hitsCount: number,
  totalCount: number,
): string | undefined {
  if (
    plan.mode !== "hits" ||
    plan.sourceQueries.length !== 1 ||
    hitsCount === 0 ||
    totalCount <= hitsCount
  ) {
    return undefined;
  }

  const execution = executions[0];
  const rawHits = asArray(asRecord(asRecord(execution?.rawResponse.hits).hits));
  const lastHit = rawHits[Math.min(rawHits.length, hitsCount) - 1];
  const sortValues = asArray(asRecord(lastHit).sort);

  if (sortValues.length === 0) {
    return undefined;
  }

  return encodeQueryCursor({
    source_id: execution.source.id,
    sort: plan.sort,
    sort_by: plan.sourceQueries[0]?.resolvedSortBy ?? plan.sortBy ?? execution.source.timeField,
    values: sortValues,
  });
}

function compareSortValues(left: unknown, right: unknown, direction: QueryPlan["sort"]): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  let comparison = 0;

  if (typeof left === "number" && typeof right === "number") {
    comparison = left - right;
  } else if (typeof left === "boolean" && typeof right === "boolean") {
    comparison = Number(left) - Number(right);
  } else {
    comparison = String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? comparison : -comparison;
}

function sortHitsGlobally(plan: QueryPlan, hits: NormalizedHit[]): NormalizedHit[] {
  const resolvedSortByBySource = new Map(
    plan.sourceQueries.map((sourceQuery) => [sourceQuery.source.id, sourceQuery.resolvedSortBy]),
  );

  return [...hits].sort((left, right) => {
    const leftSortField = resolvedSortByBySource.get(left.source_id);
    const rightSortField = resolvedSortByBySource.get(right.source_id);

    const leftSortValue = leftSortField ? left.raw_document[leftSortField] : left.timestamp;
    const rightSortValue = rightSortField ? right.raw_document[rightSortField] : right.timestamp;
    const comparison = compareSortValues(leftSortValue, rightSortValue, plan.sort);

    if (comparison !== 0) {
      return comparison;
    }

    return compareSortValues(left.timestamp, right.timestamp, plan.sort);
  });
}

function normalizeHistogram(result: KibanaSearchExecutionResult): HistogramBucket[] {
  const histogram =
    asRecord(asRecord(rawResponseWithAggs(result)).aggs).histogram ??
    asRecord(asRecord(rawResponseWithAggs(result)).aggregations).histogram;
  const buckets = asArray(asRecord(histogram).buckets);

  return buckets.map((bucket) => {
    const bucketRecord = asRecord(bucket);
    return {
      key:
        typeof bucketRecord.key === "number" || typeof bucketRecord.key === "string"
          ? bucketRecord.key
          : "",
      key_as_string:
        typeof bucketRecord.key_as_string === "string" ? bucketRecord.key_as_string : undefined,
      count: typeof bucketRecord.doc_count === "number" ? bucketRecord.doc_count : 0,
    };
  });
}

function normalizeTerms(result: KibanaSearchExecutionResult): TermsBucket[] {
  const groups =
    asRecord(asRecord(rawResponseWithAggs(result)).aggs).groups ??
    asRecord(asRecord(rawResponseWithAggs(result)).aggregations).groups;
  const buckets = asArray(asRecord(groups).buckets);

  return buckets.map((bucket) => {
    const bucketRecord = asRecord(bucket);
    return {
      key: String(bucketRecord.key ?? ""),
      count: typeof bucketRecord.doc_count === "number" ? bucketRecord.doc_count : 0,
    };
  });
}

function normalizeStatsSummary(
  statsRecord: Record<string, unknown>,
  percentilesRecord: Record<string, unknown>,
) {
  const percentileValues = asRecord(percentilesRecord.values);

  return {
    count: typeof statsRecord.count === "number" ? statsRecord.count : 0,
    min: typeof statsRecord.min === "number" ? statsRecord.min : null,
    max: typeof statsRecord.max === "number" ? statsRecord.max : null,
    avg: typeof statsRecord.avg === "number" ? statsRecord.avg : null,
    sum: typeof statsRecord.sum === "number" ? statsRecord.sum : 0,
    p50: typeof percentileValues["50.0"] === "number" ? (percentileValues["50.0"] as number) : null,
    p95: typeof percentileValues["95.0"] === "number" ? (percentileValues["95.0"] as number) : null,
    p99: typeof percentileValues["99.0"] === "number" ? (percentileValues["99.0"] as number) : null,
  };
}

function normalizeStats(
  plan: QueryPlan,
  result: KibanaSearchExecutionResult,
): NonNullable<QueryStructuredResponse["stats"]>[number] {
  const aggregations = asRecord(rawResponseWithAggs(result).aggs).stats_summary
    ? asRecord(rawResponseWithAggs(result).aggs)
    : asRecord(rawResponseWithAggs(result).aggregations);

  return {
    source_id: result.source.id,
    field: plan.statsField ?? "",
    summary: normalizeStatsSummary(
      asRecord(aggregations.stats_summary),
      asRecord(aggregations.stats_percentiles),
    ),
  };
}

function normalizeGroupedTopHits(
  plan: QueryPlan,
  result: KibanaSearchExecutionResult,
): NonNullable<QueryStructuredResponse["grouped_hits"]>[number] {
  const groups =
    asRecord(asRecord(rawResponseWithAggs(result)).aggs).groups ??
    asRecord(asRecord(rawResponseWithAggs(result)).aggregations).groups;
  const buckets = asArray(asRecord(groups).buckets);

  return {
    source_id: result.source.id,
    group_by: plan.groupBy ?? "",
    buckets: buckets.map((bucket) => {
      const bucketRecord = asRecord(bucket);
      const topHits = asArray(asRecord(asRecord(bucketRecord.top_hits).hits).hits);

      return {
        key: String(bucketRecord.key ?? ""),
        count: typeof bucketRecord.doc_count === "number" ? bucketRecord.doc_count : 0,
        hits: topHits.map((hit) => normalizeRawHit(result, asRecord(hit))),
      };
    }),
  };
}

function rawResponseWithAggs(result: KibanaSearchExecutionResult): Record<string, unknown> {
  return result.rawResponse;
}

export function normalizeQueryResponse(
  plan: QueryPlan,
  executions: KibanaSearchExecutionResult[],
): QueryStructuredResponse {
  const resolvedFilters = plan.sourceQueries.flatMap((sourceQuery) => sourceQuery.resolvedFilters);
  const advisories = plan.sourceQueries.flatMap((sourceQuery) => sourceQuery.advisories);

  if (plan.mode === "hits") {
    const normalized = executions.map(normalizeHits);
    const allHits = normalized.flatMap((entry) => entry.hits);
    const hits = sortHitsGlobally(plan, allHits).slice(0, plan.limit);
    const nextCursor = buildNextCursor(
      plan,
      executions,
      hits.length,
      normalized.reduce((sum, entry) => sum + entry.total, 0),
    );
    return {
      query_echo: {
        source_ids: plan.sourceIds,
        start_time: plan.startTime,
        end_time: plan.endTime,
        text: plan.text,
        filters: resolvedFilters,
        ...(plan.nestedFilters && plan.nestedFilters.length > 0
          ? { nested_filters: plan.nestedFilters }
          : {}),
        ...(plan.cursor ? { cursor: plan.cursor } : {}),
        mode: plan.mode,
        sort: plan.sort,
        sort_by: plan.sortBy,
        resolved_sort_by_by_source: plan.sourceQueries.map((sourceQuery) => ({
          source_id: sourceQuery.source.id,
          resolved_sort_by: sourceQuery.resolvedSortBy,
        })),
        ...(advisories.length > 0 ? { advisories } : {}),
        limit: plan.limit,
        truncated: allHits.length > plan.limit,
      },
      total: normalized.reduce((sum, entry) => sum + entry.total, 0),
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
      hits,
    };
  }

  if (plan.mode === "count") {
    const countsBySource = executions.map((execution) => ({
      source_id: execution.source.id,
      count: extractTotal(execution.rawResponse),
    }));
    return {
      query_echo: {
        source_ids: plan.sourceIds,
        start_time: plan.startTime,
        end_time: plan.endTime,
        text: plan.text,
        filters: resolvedFilters,
        ...(plan.nestedFilters && plan.nestedFilters.length > 0
          ? { nested_filters: plan.nestedFilters }
          : {}),
        ...(plan.cursor ? { cursor: plan.cursor } : {}),
        mode: plan.mode,
        sort: plan.sort,
        sort_by: plan.sortBy,
        ...(advisories.length > 0 ? { advisories } : {}),
        limit: plan.limit,
        truncated: false,
      },
      total: countsBySource.reduce((sum, entry) => sum + entry.count, 0),
      counts_by_source: countsBySource,
    };
  }

  if (plan.mode === "histogram") {
    const histograms = executions.map((execution) => ({
      source_id: execution.source.id,
      buckets: normalizeHistogram(execution),
    }));
    return {
      query_echo: {
        source_ids: plan.sourceIds,
        start_time: plan.startTime,
        end_time: plan.endTime,
        text: plan.text,
        filters: resolvedFilters,
        ...(plan.nestedFilters && plan.nestedFilters.length > 0
          ? { nested_filters: plan.nestedFilters }
          : {}),
        ...(plan.cursor ? { cursor: plan.cursor } : {}),
        mode: plan.mode,
        sort: plan.sort,
        sort_by: plan.sortBy,
        ...(advisories.length > 0 ? { advisories } : {}),
        limit: plan.limit,
        histogram_interval: plan.histogramInterval,
        truncated: false,
      },
      total: histograms.reduce(
        (sum, histogram) =>
          sum + histogram.buckets.reduce((bucketSum, bucket) => bucketSum + bucket.count, 0),
        0,
      ),
      histograms,
    };
  }

  if (plan.mode === "stats") {
    const stats = executions.map((execution) => normalizeStats(plan, execution));

    return {
      query_echo: {
        source_ids: plan.sourceIds,
        start_time: plan.startTime,
        end_time: plan.endTime,
        text: plan.text,
        filters: resolvedFilters,
        ...(plan.nestedFilters && plan.nestedFilters.length > 0
          ? { nested_filters: plan.nestedFilters }
          : {}),
        ...(plan.cursor ? { cursor: plan.cursor } : {}),
        mode: plan.mode,
        sort: plan.sort,
        sort_by: plan.sortBy,
        ...(advisories.length > 0 ? { advisories } : {}),
        limit: plan.limit,
        stats_field: plan.statsField,
        group_by: plan.groupBy,
        truncated: false,
      },
      total: stats.reduce((sum, entry) => sum + entry.summary.count, 0),
      stats,
    };
  }

  if (plan.mode === "grouped_top_hits") {
    const groupedHits = executions.map((execution) => normalizeGroupedTopHits(plan, execution));

    return {
      query_echo: {
        source_ids: plan.sourceIds,
        start_time: plan.startTime,
        end_time: plan.endTime,
        text: plan.text,
        filters: resolvedFilters,
        ...(plan.nestedFilters && plan.nestedFilters.length > 0
          ? { nested_filters: plan.nestedFilters }
          : {}),
        ...(plan.cursor ? { cursor: plan.cursor } : {}),
        mode: plan.mode,
        sort: plan.sort,
        sort_by: plan.sortBy,
        ...(advisories.length > 0 ? { advisories } : {}),
        limit: plan.limit,
        top_hits_size: plan.topHitsSize,
        group_by: plan.groupBy,
        truncated: false,
      },
      total: groupedHits.reduce(
        (sum, entry) =>
          sum + entry.buckets.reduce((bucketSum, bucket) => bucketSum + bucket.count, 0),
        0,
      ),
      grouped_hits: groupedHits,
    };
  }

  const groups = executions.map((execution) => ({
    source_id: execution.source.id,
    field: plan.groupBy ?? "",
    buckets: normalizeTerms(execution),
  }));

  return {
    query_echo: {
      source_ids: plan.sourceIds,
      start_time: plan.startTime,
      end_time: plan.endTime,
      text: plan.text,
      filters: resolvedFilters,
      ...(plan.nestedFilters && plan.nestedFilters.length > 0
        ? { nested_filters: plan.nestedFilters }
        : {}),
      ...(plan.cursor ? { cursor: plan.cursor } : {}),
      mode: plan.mode,
      sort: plan.sort,
      sort_by: plan.sortBy,
      ...(advisories.length > 0 ? { advisories } : {}),
      limit: plan.limit,
      group_by: plan.groupBy,
      truncated: false,
    },
    total: groups.reduce(
      (sum, group) =>
        sum + group.buckets.reduce((bucketSum, bucket) => bucketSum + bucket.count, 0),
      0,
    ),
    groups,
  };
}
