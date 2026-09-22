import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { WebPageCard } from "./WebPageCard";
import { CaptureScreenshot } from "./CaptureScreenshot";
import type { WebPageView } from "./WebPageView";
const source: WebPageView = {
  id: "s",
  url: "https://new-request.example",
  status: "fetching",
  hasCapture: true,
  title: "Saved page",
  capture: {
    url: "https://old-capture.example",
    screenshot: {
      url: "https://storage.example/saved.png",
      width: 1280,
      height: 800,
    },
  },
  preview: "Saved content",
};
test("refresh and failure display only the retained capture screenshot", () => {
  for (const status of ["fetching", "failed"] as const) {
    const html = renderToStaticMarkup(
      h(WebPageCard, { source: { ...source, status }, onOpen: () => {} }),
    );
    expect(html).toContain('src="https://storage.example/saved.png"');
    expect(html).not.toContain('src="https://new-request.example');
    expect(html).toContain("Saved content");
  }
});
test("legacy captures omit screenshot chrome and unavailable images have a fallback", () => {
  const legacy = renderToStaticMarkup(
    h(WebPageCard, {
      source: { ...source, capture: { url: "https://old.example" } },
      onOpen: () => {},
    }),
  );
  expect(legacy).not.toContain("<img");
  expect(legacy).not.toContain("Preview unavailable");
  const missing = renderToStaticMarkup(
    h(WebPageCard, {
      source: { ...source, capture: { screenshotError: "Image unavailable" } },
      onOpen: () => {},
    }),
  );
  expect(missing).toContain("Preview unavailable");
  expect(missing).not.toContain("<img");
});
test("screenshot is accessible, non-draggable, and rejects executable URL schemes", () => {
  const html = renderToStaticMarkup(
    h(CaptureScreenshot, {
      url: "https://storage.example/s.png",
      title: "Saved page",
      onOpen: () => {},
    }),
  );
  expect(html).toContain("Above-the-fold capture of Saved page");
  expect(html).toContain('draggable="false"');
  expect(html).toContain('referrerPolicy="no-referrer"');
  const invalid = renderToStaticMarkup(
    h(CaptureScreenshot, { url: "javascript:alert(1)", title: "Bad" }),
  );
  expect(invalid).not.toContain("<img");
  expect(invalid).toContain("Preview unavailable");
});

test("Details opens the sheet only after fetching ends", () => {
  for (const status of ["ready", "failed"] as const) {
    const html = renderToStaticMarkup(
      h(WebPageCard, { source: { ...source, status }, onOpen: () => {} }),
    );
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain(">Details</button>");
    expect(html).not.toContain("Open capture:");
    expect(html).not.toContain("Open captured screenshot");
  }
  const fetching = renderToStaticMarkup(
    h(WebPageCard, {
      source: { ...source, status: "fetching" },
      onOpen: () => {},
    }),
  );
  expect(fetching).not.toContain(">Details</button>");
});
