import { expect, test } from "vitest";
import {
  canRecoverWebPage,
  capturePrompt,
  captureUrl,
  webPageRequestError,
  type WebPageView,
} from "./WebPageView";
const source: WebPageView = {
  id: "page",
  url: "https://new.example",
  prompt: "new extraction",
  revision: 3,
  status: "fetching",
  hasCapture: true,
  capture: { url: "https://original.example", capturedAt: 100 },
};
test("retained capture provenance does not inherit the latest prompt", () => {
  expect(captureUrl(source)).toBe("https://original.example");
  expect(capturePrompt(source)).toBeUndefined();
  expect(
    capturePrompt({ ...source, hasCapture: false, capture: undefined }),
  ).toBe("new extraction");
});
test("recovery is deliberate for legacy and overdue busy revisions only", () => {
  expect(canRecoverWebPage(source, 100)).toBe(true);
  expect(canRecoverWebPage({ ...source, deadlineAt: 101 }, 100)).toBe(false);
  expect(canRecoverWebPage({ ...source, deadlineAt: 100 }, 100)).toBe(true);
  expect(
    canRecoverWebPage({ ...source, status: "ready", deadlineAt: 50 }, 100),
  ).toBe(false);
  expect(canRecoverWebPage({ ...source, revision: undefined }, 100)).toBe(
    false,
  );
});
test("conflict codes ask for review or waiting and never parse provider prose", () => {
  expect(
    webPageRequestError({ data: { code: "SOURCE_REVISION_CONFLICT" } }),
  ).toContain("Review");
  expect(
    webPageRequestError({ data: { code: "SOURCE_REQUEST_ACTIVE" } }),
  ).toContain("Wait");
  expect(webPageRequestError(new Error("SOURCE_REQUEST_ACTIVE"))).toContain(
    "could not be confirmed",
  );
});
