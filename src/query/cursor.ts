export interface QueryCursorPayload {
  source_id: string;
  sort: "asc" | "desc";
  sort_by: string;
  values: unknown[];
}

export function encodeQueryCursor(payload: QueryCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeQueryCursor(cursor: string): QueryCursorPayload {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  return JSON.parse(raw) as QueryCursorPayload;
}
