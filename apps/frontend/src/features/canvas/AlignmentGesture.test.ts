import { expect, test } from "vitest";
import { AlignmentGesture } from "./AlignmentGesture";
import type { ElementId, Geometry } from "@pluribus/core/canvas/domain";
const a = "a" as ElementId,
  b = "b" as ElementId,
  t = "t" as ElementId;
const g = { x: 0, y: 0, width: 100, height: 100 };
function updates(geometry: Geometry, active = true) {
  return new Map([[a, { geometry, active }]]);
}
test("thresholds use screen pixels at different zoom levels", () => {
  const targets = [{ id: t, geometry: { ...g, x: 200, y: 500 } }];
  for (const zoom of [0.5, 1, 2]) {
    const gesture = new AlignmentGesture(new Map([[a, g]]), targets, false);
    const changes = updates({ ...g, x: 100 - 5 / zoom });
    expect(gesture.resolve(changes, zoom, false)).toHaveLength(1);
    expect(changes.get(a)!.geometry.x).toBe(100);
  }
});
test("group snapping preserves spacing and Alt bypass returns the candidate", () => {
  const gesture = new AlignmentGesture(
    new Map([
      [a, g],
      [b, { ...g, x: 120 }],
    ]),
    [{ id: t, geometry: { ...g, x: 300, y: 500 } }],
    false,
  );
  const changes = new Map([
    [a, { geometry: { ...g, x: 76 }, active: true }],
    [b, { geometry: { ...g, x: 196 }, active: true }],
  ]);
  gesture.resolve(changes, 1, false);
  expect(changes.get(a)!.geometry.x).toBe(80);
  expect(changes.get(b)!.geometry.x).toBe(200);
  const bypass = new Map([
    [a, { geometry: { ...g, x: 76 }, active: true }],
    [b, { geometry: { ...g, x: 196 }, active: true }],
  ]);
  expect(gesture.resolve(bypass, 1, true)).toEqual([]);
  expect(bypass.get(a)!.geometry.x).toBe(76);
});
test("resizing retains unsnapped candidates for release batches", () => {
  const gesture = new AlignmentGesture(
    new Map([[a, g]]),
    [{ id: t, geometry: { ...g, x: 200, y: 500 } }],
    true,
  );
  const changes = updates({ ...g, width: 196 });
  gesture.resolve(changes, 1, false);
  expect(changes.get(a)!.geometry.width).toBe(200);
  expect(gesture.candidates.get(a)!.width).toBe(196);
  const final = updates({ ...gesture.candidates.get(a)! }, false);
  gesture.resolve(final, 1, false);
  expect(final.get(a)!.geometry.width).toBe(200);
});
test("group snapping cannot move a member beyond the coordinate limit", () => {
  const gesture = new AlignmentGesture(
    new Map([
      [a, g],
      [b, { ...g, x: 120 }],
    ]),
    [{ id: t, geometry: { ...g, x: 304, y: 500 } }],
    false,
  );
  const changes = new Map([
    [a, { geometry: { ...g, x: 80 }, active: true }],
    [b, { geometry: { ...g, x: 200 }, active: true }],
  ]);
  expect(gesture.resolve(changes, 1, false, { maxX: 200 })).toEqual([]);
  expect(changes.get(b)!.geometry.x).toBe(200);
});

test("group spacing snaps its outer edge and reports the gap without changing member spacing", () => {
  const gesture = new AlignmentGesture(
    new Map([
      [a, g],
      [b, { ...g, x: 120 }],
    ]),
    [{ id: t, geometry: { ...g, x: 300 } }],
    false,
  );
  const changes = new Map([
    [a, { geometry: { ...g, x: 52 }, active: true }],
    [b, { geometry: { ...g, x: 172 }, active: true }],
  ]);
  const guides = gesture.resolve(changes, 1, false);
  expect(changes.get(a)!.geometry.x).toBe(56);
  expect(changes.get(b)!.geometry.x).toBe(176);
  expect(guides.find((g) => g.axis === "x")!.gap).toEqual({
    from: 276,
    to: 300,
    at: 50,
    size: 24,
  });
  const bypass = new Map([
    [a, { geometry: { ...g, x: 52 }, active: true }],
    [b, { geometry: { ...g, x: 172 }, active: true }],
  ]);
  expect(gesture.resolve(bypass, 1, true)).toEqual([]);
  expect(bypass.get(a)!.geometry.x).toBe(52);
});

test("spacing preview precedes snap without changing geometry and respects bypass/range", () => {
  const viewport = { x: -500, y: -500, width: 2000, height: 2000 };
  for (const zoom of [0.5, 1, 2]) {
    const gesture = new AlignmentGesture(
      new Map([[a, g]]),
      [{ id: t, geometry: { ...g, x: 300 } }],
      false,
    );
    const changes = updates({ ...g, x: 176 - 16 / zoom });
    gesture.resolve(changes, zoom, false);
    expect(changes.get(a)!.geometry.x).toBe(176 - 16 / zoom);
    expect(gesture.preview(zoom, false, viewport)[0].geometry.x).toBe(176);
    expect(gesture.preview(zoom, true, viewport)).toEqual([]);
    gesture.resolve(updates({ ...g, x: 176 - 50 / zoom }), zoom, false);
    expect(gesture.preview(zoom, false, viewport)).toEqual([]);
  }
});

test("release lands on the last visible preview and bypass discards it", () => {
  const gesture = new AlignmentGesture(
    new Map([[a, g]]),
    [{ id: t, geometry: { ...g, x: 300 } }],
    false,
  );
  gesture.resolve(updates({ ...g, x: 160 }), 1, false);
  const preview = gesture.preview(1, false, {
    x: -500,
    y: -500,
    width: 2000,
    height: 2000,
  });
  expect(preview[0].geometry.x).toBe(176);
  expect(gesture.releasePreview(false)).toEqual(preview);
  expect(gesture.releasePreview(false)).toEqual([]);
  gesture.preview(1, false, { x: -500, y: -500, width: 2000, height: 2000 });
  expect(gesture.releasePreview(true)).toEqual([]);
});
