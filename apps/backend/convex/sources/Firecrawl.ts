import { screenshotFormat } from "./Screenshot";
import {
  type SourceTable,
  assertExtractionIntent,
  normalizeSourceTable,
  isSourceTableData,
  isInferredSourceData,
  SourceExtractionIntentError,
} from "@pluribus/core/sources/domain";
import {
  providerJson,
  object,
  text,
  ProviderHttpError,
} from "../integrations/Http";

/** Converts known transport failures into safe, actionable capture messages. */
export function captureFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message === "Invalid inferred extraction")
    return "The page provider returned an invalid extraction. Try again or refine the instructions.";
  if (error instanceof SourceExtractionIntentError) return error.message;
  if (error instanceof Error && error.message === "Invalid table extraction")
    return "The page provider did not return rows matching the requested columns. Refine what to extract and try again.";
  if (error instanceof ProviderHttpError) {
    switch (error.status) {
      case 401:
        return "The page provider rejected its API key. Check the backend configuration.";
      case 402:
        return "The page provider has insufficient credits. Check the provider account.";
      case 403:
        return "The page provider refused this request. This site may be unsupported or access-restricted.";
      case 408:
      case 504:
        return "Page retrieval timed out. Try again later.";
      case 429:
        return "The page provider is rate-limiting requests. Try again later.";
      default:
        return `Page retrieval failed (provider HTTP ${error.status}). Try again later.`;
    }
  }
  if (error instanceof Error) {
    if (["TimeoutError", "AbortError"].includes(error.name))
      return "Page retrieval timed out. Try again later.";
    if (error.message === "Firecrawl is not configured")
      return "The page provider is not configured. Set FIRECRAWL_API_KEY on the backend.";
    if (
      [
        "Provider result exceeds size limit",
        "Extracted result too large",
        "Capture too large",
      ].includes(error.message)
    )
      return "This page is too large to capture.";
    if (
      error instanceof SyntaxError ||
      [
        "Malformed provider response",
        "Invalid provider field",
        "Empty provider response",
        "Missing capture output",
      ].includes(error.message)
    )
      return "The page provider returned an invalid response. Try again later.";
  }
  return "Page retrieval failed. Try again later or use another page.";
}
/** Only the provider fetches target pages; input checks reject literal/private destinations. DNS/redirect enforcement remains provider-owned. */
export function publicSourceUrl(raw: string) {
  if (raw.length > 2048) throw new Error("URL too long");
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname.includes(".") ||
    /^(\d+\.){3}\d+$/.test(url.hostname) ||
    url.hostname.includes(":") ||
    /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)
  )
    throw new Error("Use a public HTTP or HTTPS page");
  return url.href;
}
/** Firecrawl schema is explicit: extract page facts, never describe the instruction. */
function tableFormat(prompt: string, table: SourceTable) {
  return {
    type: "json",
    prompt: `Extract facts from the page according to this request: ${prompt}\nReturn matching page records only. Do not describe the request, output format, or schema. Use null for unavailable fields. If no records match, return an empty rows array.`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["rows"],
      properties: {
        rows: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            required: table.columns,
            properties: Object.fromEntries(
              table.columns.map((column) => [
                column,
                { type: ["string", "null"], maxLength: 10000 },
              ]),
            ),
          },
        },
      },
    },
  };
}
/** One extraction call lets the provider infer presentation from actual page facts. */
function inferredFormat(prompt: string) {
  return {
    type: "json",
    prompt: `Follow these instructions using the actual page content: ${prompt}\nChoose kind text for prose or kind table for records/comparisons or requested tabular output. Infer useful columns from the page and instructions; honor explicitly named columns and their order. For format-only instructions such as Return as CSV table, extract the page's relevant facts or records into a useful table. Never return a description of the request, output format, or schema. Never invent missing facts; use null for unavailable cells. For a table, columns are unique labels and rows are arrays in exactly that column order; text may provide a short explanation. No matches means rows: []. For text, put the answer in text and use empty columns and rows.`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "text", "columns", "rows"],
      properties: {
        kind: { type: "string", enum: ["text", "table"] },
        text: { type: "string", maxLength: 100000 },
        columns: {
          type: "array",
          maxItems: 20,
          uniqueItems: true,
          items: { type: "string", minLength: 1, maxLength: 80 },
        },
        rows: {
          type: "array",
          maxItems: 200,
          items: {
            type: "array",
            maxItems: 20,
            items: { type: ["string", "null"], maxLength: 10000 },
          },
        },
      },
    },
  };
}
export async function scrapePage(input: {
  url: string;
  prompt?: string;
  table?: SourceTable;
}) {
  const table = input.table ? normalizeSourceTable(input.table) : undefined;
  assertExtractionIntent(input.prompt, table);
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Firecrawl is not configured");
  const response = object(
    await providerJson("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: publicSourceUrl(input.url),
        formats: [
          screenshotFormat,
          ...(input.prompt
            ? [
                "markdown",
                table
                  ? tableFormat(input.prompt, table)
                  : inferredFormat(input.prompt),
              ]
            : ["markdown"]),
        ],
        onlyMainContent: true,
        timeout: 25000,
        proxy: "basic",
      }),
    }),
  );
  if (response.success !== true)
    throw new Error("Firecrawl could not retrieve this page");
  const data = object(response.data),
    content = data.markdown === undefined ? "" : text(data.markdown),
    structured =
      data.json === undefined ? undefined : JSON.stringify(data.json);
  // Every request retains original Markdown alongside validated extraction output.
  if (!content.trim()) throw new Error("Missing capture output");
  if (input.prompt && (data.json === null || typeof data.json !== "object"))
    throw new Error("Missing capture output");
  if (table && !isSourceTableData(data.json, table))
    throw new Error("Invalid table extraction");
  if (input.prompt && !table && !isInferredSourceData(data.json))
    throw new Error("Invalid inferred extraction");
  if (structured && structured.length > 100000)
    throw new Error("Extracted result too large");
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const title =
    typeof metadata.title === "string"
      ? metadata.title.slice(0, 300)
      : undefined;
  return {
    content,
    ...(typeof data.screenshot === "string"
      ? { screenshotUrl: data.screenshot }
      : {}),
    ...(title ? { title } : {}),
    ...(structured ? { data: structured } : {}),
    ...(input.prompt && !table
      ? { extractionFormat: "inferred-v1" as const }
      : {}),
  };
}
