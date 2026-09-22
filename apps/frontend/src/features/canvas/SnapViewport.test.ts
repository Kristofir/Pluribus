import { expect, test } from "vitest";
import { targetsInView } from "./SnapViewport";
import { AlignmentGesture } from "./AlignmentGesture";
import type { ElementId } from "@pluribus/core/canvas/domain";
const a = "a" as ElementId,
  b = "b" as ElementId;
test("viewport filtering includes intersecting cards and 160 screen pixels around it at each zoom", () => {
  for (const zoom of [0.5, 1, 2]) {
    const viewport = { x: 100, y: 200, width: 800 / zoom, height: 600 / zoom };
    const edge = viewport.x + viewport.width + 160 / zoom;
    const targets = [
      { id: a, geometry: { x: edge, y: 200, width: 100, height: 100 } },
      { id: b, geometry: { x: edge + 1, y: 200, width: 100, height: 100 } },
    ];
    expect(targetsInView(targets, viewport, zoom).map((t) => t.id)).toEqual([
      a,
    ]);
  }
});
test("offscreen targets cannot hold a snap after viewport changes", () => {
  const g = { x: 0, y: 0, width: 100, height: 100 };
  const gesture = new AlignmentGesture(
    new Map([[a, g]]),
    [{ id: b, geometry: { ...g, x: 200, y: 0 } }],
    false,
  );
  const updates = () =>
    new Map([[a, { geometry: { ...g, x: 96 }, active: true }]]);
  expect(
    gesture.resolve(
      updates(),
      1,
      false,
      {},
      { x: 0, y: 0, width: 800, height: 600 },
    ),
  ).not.toHaveLength(0);
  expect(
    gesture.resolve(
      updates(),
      1,
      false,
      {},
      { x: 2000, y: 2000, width: 800, height: 600 },
    ),
  ).toEqual([]);
});
