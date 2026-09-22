import { expect, test } from "vitest";
import {
  captureFormat,
  csvCapture,
  jsonCapture,
  structuredCapture,
  inferredCapture,
} from "./CaptureFormat";
test("flat JSON records retain union columns, missing cells and scalar values", () => {
  expect(
    jsonCapture(
      '[{"name":"A","count":0,"active":false},{"name":"B","extra":null}]',
    ),
  ).toEqual({
    kind: "table",
    columns: ["name", "count", "active", "extra"],
    rows: [
      ["A", "0", "false", "—"],
      ["B", "—", "—", "null"],
    ],
  });
});
test("nested, primitive and mixed JSON keep their raw representation", () => {
  for (const text of [
    '{"items":[1]}',
    '[{"nested":{"x":1}}]',
    "[1,2]",
    "null",
    "[{},3]",
    "[{}]",
  ])
    expect(jsonCapture(text)).toMatchObject({ kind: "raw", text });
});
test("valid empty extraction differs from invalid JSON", () => {
  for (const text of ["[]", "{}"])
    expect(jsonCapture(text)).toEqual({ kind: "empty" });
  for (const text of ["", '[{"x":', "{bad}"])
    expect(jsonCapture(text)).toMatchObject({
      kind: "raw",
      error: expect.any(String),
      text,
    });
});
test("CSV handles quoted commas, escaped quotes, CRLF and multiline fields", () => {
  expect(
    csvCapture(
      'name,note\r\nA,"hello, world"\r\nB,"two\nlines and ""quotes"""',
    ),
  ).toEqual({
    kind: "table",
    columns: ["name", "note"],
    rows: [
      ["A", "hello, world"],
      ["B", 'two\nlines and "quotes"'],
    ],
  });
});
test("malformed CSV differs from header-only and empty results", () => {
  for (const text of ["name,count\nA,1,2", 'name,note\nA,"unterminated'])
    expect(csvCapture(text)).toMatchObject({
      kind: "raw",
      error: expect.any(String),
    });
  for (const text of ["", "name,count\n"])
    expect(csvCapture(text)).toEqual({ kind: "empty" });
});
test("CSV inference is conservative and explicit format remains available", () => {
  expect(captureFormat("name,count\nA,2").kind).toBe("table");
  expect(captureFormat("Hello, reader.\nToday, we have news.").kind).toBe(
    "markdown",
  );
  expect(captureFormat("name,city\nAlice,Paris").kind).toBe("markdown");
  expect(captureFormat("name,city\nAlice,Paris", "csv").kind).toBe("table");
  expect(captureFormat("[read this](https://example.com)").kind).toBe(
    "markdown",
  );
});

test("schema-backed rows retain requested order and distinguish empty/malformed", () => {
  expect(
    structuredCapture('{"rows":[{"b":"two","a":"one"}]}', ["a", "b"]),
  ).toEqual({ kind: "table", columns: ["a", "b"], rows: [["one", "two"]] });
  expect(structuredCapture('{"rows":[]}', ["a"])).toEqual({ kind: "empty" });
  expect(structuredCapture('{"rows":[{"b":"wrong"}]}', ["a"])).toMatchObject({
    kind: "raw",
    error: expect.any(String),
  });
  expect(jsonCapture('{"rows":[{"a":"one"}]}').kind).toBe("raw");
});

test("marked inference renders text or ordered rows with context", () => {
  expect(
    inferredCapture(
      JSON.stringify({
        kind: "text",
        text: "# Summary",
        columns: [],
        rows: [],
      }),
    ),
  ).toEqual({ kind: "markdown", text: "# Summary" });
  expect(
    inferredCapture(
      JSON.stringify({
        kind: "table",
        text: "Context",
        columns: ["Score", "Name"],
        rows: [
          ["2", "Alpha"],
          [null, "Beta"],
        ],
      }),
    ),
  ).toEqual({
    kind: "mixed",
    text: "Context",
    table: {
      kind: "table",
      columns: ["Score", "Name"],
      rows: [
        ["2", "Alpha"],
        ["—", "Beta"],
      ],
    },
  });
  expect(
    inferredCapture(
      JSON.stringify({ kind: "table", text: "", columns: ["Name"], rows: [] }),
    ),
  ).toEqual({ kind: "empty" });
});
test("invalid inference preserves raw data and unmarked envelopes stay raw", () => {
  const data = JSON.stringify({
    kind: "table",
    text: "",
    columns: ["Name"],
    rows: [["too", "wide"]],
  });
  expect(inferredCapture(data)).toMatchObject({
    kind: "raw",
    text: data,
    error: expect.any(String),
  });
  expect(
    jsonCapture(
      JSON.stringify({ kind: "text", text: "hello", columns: [], rows: [] }),
    ).kind,
  ).toBe("raw");
});
