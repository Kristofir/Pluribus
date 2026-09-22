import { createElement as h } from "react";
import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaptureContent, CaptureText } from "./CaptureContent";
test("mixed prose, fenced tables, lists and code retain their order", () => {
  const html = renderToStaticMarkup(
    h(CaptureText, {
      text: "# Report\n\nBefore\n\n```csv\nname,count\nA,2\n```\n\nAfter\n\n- item\n\n`code`",
    }),
  );
  expect(html).toContain("<h1>Report</h1>");
  expect(html.indexOf("Before")).toBeLessThan(html.indexOf("<table>"));
  expect(html.indexOf("</table>")).toBeLessThan(html.indexOf("After"));
  expect(html).toContain("<li>item</li>");
  expect(html).toContain("<code>code</code>");
});
test("captured Markdown and extraction both render with unmodified originals", () => {
  const html = renderToStaticMarkup(
    h(CaptureContent, { content: "A summary", data: '[{"count":2}]' }),
  );
  expect(html).toContain("A summary");
  expect(html).toContain("<td>2</td>");
  expect(html).toContain("Original response");
  expect(html).toContain("[{&quot;count&quot;:2}]");
});
test("raw HTML, unsafe links and remote images cannot execute", () => {
  const html = renderToStaticMarkup(
    h(CaptureText, {
      text: "<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![tracking](https://example.com/pixel)\n\n[safe](https://example.com)",
    }),
  );
  expect(html).not.toContain("<script");
  expect(html).not.toContain('href="javascript:');
  expect(html).not.toContain("<img");
  expect(html).toContain('href="https://example.com"');
});
test("truncated preview is never parsed as broken JSON or a fenced table", () => {
  const html = renderToStaticMarkup(
    h(CaptureText, { preview: true, text: '```json\n[{"name":"cut off' }),
  );
  expect(html).not.toContain("Could not parse");
  expect(html).not.toContain("<table>");
});

test("explicit all-string CSV produces a table without changing text", () => {
  const text = "name,city\nAlice,London\nBob,Paris";
  const html = renderToStaticMarkup(h(CaptureText, { text, format: "csv" }));
  expect(html).toContain("<td>London</td>");
  expect(renderToStaticMarkup(h(CaptureContent, { content: text }))).toContain(
    text,
  );
});
test("malformed structured fences retain prose and raw data", () => {
  const html = renderToStaticMarkup(
    h(CaptureText, { text: "Before\n\n```json\n{bad}\n```\n\nAfter" }),
  );
  expect(html).toContain("Could not parse JSON");
  expect(html).toContain("{bad}");
  expect(html).toContain("Before");
  expect(html).toContain("After");
});

test("layout-only preview gives a neutral open-capture hint and table provenance wins", async () => {
  const { WebPageCard } = await import("./WebPageCard");
  const source = {
    id: "page",
    url: "https://example.com",
    status: "ready" as const,
    hasCapture: true,
    preview: "| Nav | Login |\n| --- | --- |",
    table: { columns: ["New request"] },
  };
  const plain = renderToStaticMarkup(
    h(WebPageCard, { source, onOpen: () => {} }),
  );
  expect(plain).toContain("View details for page content.");
  expect(plain).not.toContain("No readable content");
  const table = renderToStaticMarkup(
    h(WebPageCard, {
      source: {
        ...source,
        capture: { table: { columns: ["Original column"] } },
      },
      onOpen: () => {},
    }),
  );
  expect(table).toContain("Original column");
  expect(table).not.toContain("New request");
});

test("inferred envelope context and table render while originals remain accessible", () => {
  const data = JSON.stringify({
    kind: "table",
    text: "## Results",
    columns: ["Name"],
    rows: [["Alpha"]],
  });
  const html = renderToStaticMarkup(
    h(CaptureContent, {
      content: "Original source",
      data,
      extractionFormat: "inferred-v1",
    }),
  );
  expect(html).toContain("<h2>Results</h2>");
  expect(html).toContain("<td>Alpha</td>");
  expect(html).toContain("Original source");
  expect(html).toContain("Original response");
});
