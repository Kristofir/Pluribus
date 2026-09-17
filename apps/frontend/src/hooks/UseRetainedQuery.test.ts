import { expect, test } from "vitest";
import { retainQueryValue } from "./UseRetainedQuery";

test("a failed or temporarily unavailable subscription retains the exact successful value", () => {
  const cards = [{ id: "card", generation: 3 }];
  const good = retainQueryValue(undefined, "canvas", cards);
  const failed = retainQueryValue(good, "canvas", new Error("Query timed out"));
  expect(failed.value).toBe(cards);
  expect(retainQueryValue(failed, "canvas", undefined).value).toBe(cards);
  const restored = [{ id: "card", generation: 5 }];
  expect(retainQueryValue(failed, "canvas", restored).value).toBe(restored);
});

test("retention cannot expose the prior context's records after query identity changes", () => {
  const previous = retainQueryValue(undefined, "document:a:1", { version: 7 });
  expect(
    retainQueryValue(previous, "document:b:1", new Error("Denied")).value,
  ).toBeUndefined();
  expect(
    retainQueryValue(previous, "document:a:3", undefined).value,
  ).toBeUndefined();
  expect(retainQueryValue(previous, "document:a:1", null).value).toBeNull();
});
