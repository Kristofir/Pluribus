import { expect, test } from "vitest";
import {
  assertExtractionIntent,
  normalizeSourceTable,
  isInferredSourceData,
} from "./Source";

test("substantive prompts mentioning output formats remain valid", () => {
  for (const prompt of [
    "Extract products and prices as CSV",
    "List HTML table names",
    "Explain JSON parsing examples",
  ])
    expect(() => assertExtractionIntent(prompt)).not.toThrow();
  expect(() => assertExtractionIntent(undefined)).not.toThrow();
  expect(() =>
    assertExtractionIntent(undefined, { columns: ["Name"] }),
  ).toThrow("Describe what to extract");
});

test.each([
  [],
  [""],
  ["A", " a "],
  ["__proto__"],
  ["constructor"],
  ["x".repeat(81)],
  Array.from({ length: 21 }, (_, i) => String(i)),
])("rejects invalid columns %j", (columns) => {
  expect(() => normalizeSourceTable({ columns })).toThrow();
});

test("inferred mode accepts format-only instructions without requiring column inputs", () => {
  expect(() => assertExtractionIntent("Return as CSV table")).not.toThrow();
});

test.each([
  { kind: "table", text: "", columns: ["A", "a"], rows: [] },
  { kind: "table", text: "", columns: [" A "], rows: [] },
  { kind: "table", text: "", columns: ["__proto__"], rows: [] },
  { kind: "table", text: "", columns: [], rows: [] },
  { kind: "table", text: "", columns: ["A"], rows: [[42]] },
  { kind: "table", text: "", columns: ["A"], rows: [["x".repeat(10001)]] },
  {
    kind: "table",
    text: "",
    columns: ["A"],
    rows: Array.from({ length: 201 }, () => ["A"]),
  },
  { kind: "text", text: "Answer", columns: ["A"], rows: [] },
  { kind: "text", text: "Answer", columns: [], rows: [], extra: "metadata" },
])("rejects invalid inferred shape %#", (value) =>
  expect(isInferredSourceData(value)).toBe(false),
);

test("inferred text, table and no-match shapes are valid", () => {
  for (const value of [
    { kind: "text", text: "Answer", columns: [], rows: [] },
    {
      kind: "table",
      text: "Context",
      columns: ["Name", "Price"],
      rows: [["A", null]],
    },
    { kind: "table", text: "No matching records", columns: ["Name"], rows: [] },
  ])
    expect(isInferredSourceData(value)).toBe(true);
});
