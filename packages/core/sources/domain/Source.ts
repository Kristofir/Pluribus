export const sourceLimits = { maxCount: 20 } as const;
export type SourceStatus = "queued" | "fetching" | "ready" | "failed";
export const sourceDeadlineMs = 120000;
export function sourceIsBusy(status: SourceStatus) {
  return status === "queued" || status === "fetching";
}
/** A response belongs only to the request revision which is still fetching. */
export function canCompleteSource(
  current: { revision: number; status: SourceStatus; removed?: boolean },
  revision: number,
) {
  return (
    !current.removed &&
    current.revision === revision &&
    current.status === "fetching"
  );
}

/** A deterministic source request rejection; no capture or History action was accepted. */
export class SourceInputError extends Error {}

/** User-defined extraction columns; display format is a frontend concern. */
export type SourceTable = { columns: string[] };
export class SourceExtractionIntentError extends SourceInputError {}

/** Legacy explicit-table inputs require intent; inferred mode accepts format-only instructions. */
export function assertExtractionIntent(prompt?: string, table?: SourceTable) {
  const formatOnly =
    /^(?:(?:please\s+)?(?:return|show|display|format|output|give(?:\s+me)?|convert)(?:\s+(?:it|this|the\s+(?:result|output)))?\s+)?(?:(?:as|in|into)\s+)?(?:a\s+)?(?:csv(?:\s+table)?|json|(?:markdown\s+)?table|text)(?:\s+(?:format|only))?[.!]?$/i;
  if (table && (!prompt?.trim() || formatOnly.test(prompt.trim())))
    throw new SourceExtractionIntentError(
      "Describe what to extract from the page, such as products and prices. Describe the page facts or records you want.",
    );
}

/** Normalize a small explicit schema before a request is accepted or compared. */
export function normalizeSourceTable(table: SourceTable): SourceTable {
  const columns = table.columns.map((column) => column.trim());
  if (
    columns.length < 1 ||
    columns.length > 20 ||
    columns.some(
      (column) =>
        !column ||
        column.length > 80 ||
        ["__proto__", "prototype", "constructor"].includes(
          column.toLowerCase(),
        ),
    ) ||
    new Set(columns.map((column) => column.toLowerCase())).size !==
      columns.length
  )
    throw new SourceInputError(
      "Use 1–20 unique column names, each 1–80 characters; reserved object keys are not allowed.",
    );
  return { columns };
}

/** Accept only bounded rows matching the requested columns, including an empty result. */
export function isSourceTableData(value: unknown, table: SourceTable): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    !Array.isArray(record.rows) ||
    record.rows.length > 200
  )
    return false;
  return record.rows.every((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const cells = row as Record<string, unknown>;
    return (
      Object.keys(cells).length === table.columns.length &&
      table.columns.every(
        (column) =>
          Object.prototype.hasOwnProperty.call(cells, column) &&
          (cells[column] === null ||
            (typeof cells[column] === "string" &&
              cells[column].length <= 10000)),
      )
    );
  });
}

/** Versioned provider-inferred output; columns are ordered and row cells match that order. */
export type InferredSourceData = {
  kind: "text" | "table";
  text: string;
  columns: string[];
  rows: (string | null)[][];
};

/** Validates inferred structure without interpreting the user's instructions. */
export function isInferredSourceData(
  value: unknown,
): value is InferredSourceData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).length !== 4 ||
    !["kind", "text", "columns", "rows"].every((key) =>
      Object.prototype.hasOwnProperty.call(data, key),
    ) ||
    typeof data.text !== "string" ||
    data.text.length > 100000 ||
    !Array.isArray(data.columns) ||
    !Array.isArray(data.rows)
  )
    return false;
  if (data.kind === "text")
    return (
      !!data.text.trim() && data.columns.length === 0 && data.rows.length === 0
    );
  if (
    data.kind !== "table" ||
    !data.columns.every((column) => typeof column === "string")
  )
    return false;
  try {
    const normalized = normalizeSourceTable({
      columns: data.columns as string[],
    });
    if (
      normalized.columns.some(
        (column, i) => column !== (data.columns as string[])[i],
      )
    )
      return false;
  } catch {
    return false;
  }
  const width = data.columns.length;
  return (
    data.rows.length <= 200 &&
    data.rows.every(
      (row) =>
        Array.isArray(row) &&
        row.length === width &&
        row.every(
          (cell) =>
            cell === null || (typeof cell === "string" && cell.length <= 10000),
        ),
    )
  );
}
