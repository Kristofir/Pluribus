import { expect, test } from "vitest";
import { capturePreview } from "./CapturePreview";
test("layout tables and navigation do not displace prose", () => {
  const text =
    "[Home](/) | [New](/new) | [Login](/login)\n\n| menu | links |\n| --- | --- |\n| top | nav |\n\n# Findings\n\nUseful source content.";
  expect(capturePreview(text)).toBe("# Findings\n\nUseful source content.");
  expect(text).toContain("| menu |");
});
test("table-only and truncated structured responses remain available only in full capture", () => {
  expect(
    capturePreview("| story | points |\n| --- | --- |\n| News | 3 |"),
  ).toBe("");
  expect(capturePreview('```json\n{"cut":')).toBe("");
  expect(capturePreview('{"title":')).toBe("");
});
test("ordinary source links and paragraphs survive", () => {
  const text =
    "[A story](https://example.com)\n\nText, with commas and meaningful details.";
  expect(capturePreview(text)).toBe(text);
});
