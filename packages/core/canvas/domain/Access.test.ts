import { expect, test } from "vitest";
import { assertCanvasAccess } from "./Access";

test("both server-classified anonymous and authenticated participants can use the current canvas", () => {
  expect(() => assertCanvasAccess({ kind: "anonymous" })).not.toThrow();
  expect(() => assertCanvasAccess({ kind: "authenticated" })).not.toThrow();
});
