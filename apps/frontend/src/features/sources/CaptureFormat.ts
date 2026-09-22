import {
  isSourceTableData,
  isInferredSourceData,
} from "@pluribus/core/sources/domain";
import Papa from "papaparse";

export type CaptureFormat =
  | { kind: "mixed"; text: string; table: CaptureFormat }
  | { kind: "markdown"; text: string }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "empty" }
  | { kind: "raw"; text: string; format: "json" | "csv"; error?: string };
const scalar = (value: unknown) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function jsonCapture(text: string): CaptureFormat {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      kind: "raw",
      text,
      format: "json",
      error: "Could not parse JSON. Original response is shown below.",
    };
  }
  if (
    (Array.isArray(value) && value.length === 0) ||
    (record(value) && Object.keys(value).length === 0)
  )
    return { kind: "empty" };
  if (
    Array.isArray(value) &&
    value.every(record) &&
    value.every((row) => Object.values(row).every(scalar))
  ) {
    const columns = [...new Set(value.flatMap((row) => Object.keys(row)))];
    if (columns.length > 0 && columns.length <= 30)
      return {
        kind: "table",
        columns,
        rows: value.map((row) =>
          columns.map((column) =>
            Object.hasOwn(row, column)
              ? row[column] === null
                ? "null"
                : String(row[column])
              : "—",
          ),
        ),
      };
  }
  return { kind: "raw", text, format: "json" };
}

export function csvCapture(text: string): CaptureFormat {
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ",",
    skipEmptyLines: "greedy",
  });
  const [columns, ...rows] = parsed.data;
  if (
    parsed.errors.length ||
    (columns && rows.some((row) => row.length !== columns.length))
  )
    return {
      kind: "raw",
      text,
      format: "csv",
      error:
        "Could not parse a consistent CSV table. Original response is shown below.",
    };
  if (!columns || !rows.length) return { kind: "empty" };
  if (columns.length > 30) return { kind: "raw", text, format: "csv" };
  return { kind: "table", columns, rows };
}

/** Infer only complete documents. Bounded canvas previews must never use this. */
export function captureFormat(
  text: string,
  format?: "json" | "csv",
): CaptureFormat {
  if (format === "json") return jsonCapture(text);
  if (format === "csv") return csvCapture(text);
  const trimmed = text.trim();
  if (/^[\[{]/.test(trimmed)) {
    const json = jsonCapture(text);
    // A malformed JSON-looking Markdown paragraph is not evidence of a parse error.
    if (json.kind !== "raw" || !json.error) return json;
  }
  const csv = csvCapture(text);
  if (
    csv.kind === "table" &&
    csv.columns.length > 1 &&
    new Set(csv.columns).size === csv.columns.length &&
    csv.columns.every((name) => /^[A-Za-z][\w -]{0,63}$/.test(name.trim())) &&
    csv.rows.some((row) =>
      row.some((cell) => /^(?:-?\d+(?:\.\d+)?|true|false)$/.test(cell.trim())),
    )
  )
    return csv;
  return { kind: "markdown", text };
}

/** Only schema-backed captures may interpret a rows envelope as a table. */
export function structuredCapture(
  text: string,
  columns: string[],
): CaptureFormat {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return jsonCapture(text);
  }
  if (!isSourceTableData(value, { columns }))
    return {
      kind: "raw",
      text,
      format: "json",
      error:
        "This response does not match the requested columns. Original response is shown below.",
    };
  const { rows } = value as { rows: Record<string, string | null>[] };
  if (!rows.length) return { kind: "empty" };
  return {
    kind: "table",
    columns,
    rows: rows.map((row) =>
      columns.map((column) =>
        row[column] === null ? "—" : String(row[column]),
      ),
    ),
  };
}

export function inferredCapture(text: string): CaptureFormat {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return jsonCapture(text);
  }
  if (!isInferredSourceData(value))
    return {
      kind: "raw",
      text,
      format: "json",
      error:
        "Could not read the inferred result. Original response is shown below.",
    };
  const result = value;
  if (result.kind === "text") return { kind: "markdown", text: result.text };
  const table: CaptureFormat = result.rows.length
    ? {
        kind: "table",
        columns: result.columns,
        rows: result.rows.map((row) =>
          row.map((cell) => (cell === null ? "—" : cell)),
        ),
      }
    : { kind: "empty" };
  return result.text.trim()
    ? { kind: "mixed", text: result.text, table }
    : table;
}
