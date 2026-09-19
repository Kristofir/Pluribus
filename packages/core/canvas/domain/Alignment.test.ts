import { expect, test } from "vitest";
import { resolveAlignment } from "./Alignment";
import type { ElementId } from "./Element";
const target = {
  id: "target" as ElementId,
  geometry: { x: 200, y: 300, width: 100, height: 100 },
};
const candidate = { x: 96, y: 196, width: 100, height: 100 };
test("aligns edges independently on both axes", () => {
  const result = resolveAlignment(
    candidate,
    [target],
    { kind: "move" },
    { acquire: 6, release: 10 },
  );
  expect(result.geometry).toEqual({ ...candidate, x: 100, y: 200 });
  expect(result.matches.map((m) => m.sourceAnchor)).toEqual(["end", "end"]);
});
test("holds an alignment until release distance, without accumulating drift", () => {
  const first = resolveAlignment(
    candidate,
    [target],
    { kind: "move" },
    { acquire: 6, release: 10 },
  );
  const held = resolveAlignment(
    { ...candidate, x: 91 },
    [target],
    { kind: "move" },
    { acquire: 6, release: 10, previous: first.matches },
  );
  expect(held.geometry.x).toBe(100);
  const released = resolveAlignment(
    { ...candidate, x: 89 },
    [target],
    { kind: "move" },
    { acquire: 6, release: 10, previous: held.matches },
  );
  expect(released.geometry.x).toBe(89);
});
test("supports centers and resolves equal distances deterministically", () => {
  const a = {
    id: "a" as ElementId,
    geometry: { x: 194, y: 0, width: 100, height: 100 },
  };
  const b = {
    id: "b" as ElementId,
    geometry: { x: 206, y: 0, width: 100, height: 100 },
  };
  const g = { x: 225, y: 500, width: 50, height: 100 };
  const resolve = (targets: (typeof a)[]) =>
    resolveAlignment(g, targets, { kind: "move" }, { acquire: 6, release: 10 });
  expect(resolve([b, a])).toEqual(resolve([a, b]));
  expect(resolve([a, b]).matches[0].sourceAnchor).toBe("center");
});
test("resizing adjusts only moving edges and respects minimum content height", () => {
  const g = { x: 200, y: 304, width: 100, height: 196 };
  const result = resolveAlignment(
    g,
    [target],
    { kind: "resize", y: "start" },
    { acquire: 6, release: 10, constraints: { minHeight: 190 } },
  );
  expect(result.geometry).toEqual({ ...g, y: 300, height: 200 });
  expect(result.matches).toHaveLength(1);
  const limited = resolveAlignment(
    { ...g, y: 296, height: 204 },
    [target],
    { kind: "resize", y: "start" },
    { acquire: 6, release: 10, constraints: { minHeight: 204 } },
  );
  expect(limited.matches).toHaveLength(0);
  expect(limited.geometry.height).toBe(204);
});
test("does not snap outside coordinate or maximum size limits", () => {
  const result = resolveAlignment(
    candidate,
    [target],
    { kind: "resize", x: "end" },
    { acquire: 6, release: 10, constraints: { maxWidth: 100 } },
  );
  expect(result.geometry.width).toBe(100);
  expect(result.matches).toHaveLength(0);
});
