import { expect, test } from "vitest";
import { CursorTimeline } from "./CursorTimeline";

test("first sample appears immediately; irregular arrivals interpolate on a delayed timeline", () => {
  const cursor = new CursorTimeline();
  cursor.push({ x: 0, y: 0 }, 1, 0);
  expect(cursor.sample(0)?.point.x).toBe(0);
  cursor.push({ x: 80, y: 40 }, 2, 80);
  cursor.push({ x: 190, y: 95 }, 3, 190);
  const xs = [130, 150, 170, 190, 210, 230].map(
    (t) => cursor.sample(t)!.point.x,
  );
  expect(xs).toEqual([50, 70, 90, 110, 130, 150]);
  expect(cursor.sample(400)).toMatchObject({
    point: { x: 190, y: 95 },
    moving: false,
  });
});
test("stale sequences are ignored and long gaps reset without flying across old positions", () => {
  const cursor = new CursorTimeline();
  cursor.push({ x: 10, y: 20 }, 2, 0);
  expect(cursor.push({ x: 1000, y: 0 }, 1, 50)).toBe(false);
  cursor.push({ x: 500, y: 600 }, 3, 800);
  expect(cursor.sample(800)).toMatchObject({
    point: { x: 500, y: 600 },
    moving: false,
  });
});
test("settle discards interpolation for reduced motion and hidden pages", () => {
  const cursor = new CursorTimeline();
  cursor.push({ x: 0, y: 0 }, 1, 0);
  cursor.push({ x: 80, y: 20 }, 2, 80);
  cursor.settle();
  expect(cursor.sample(80)).toMatchObject({
    point: { x: 80, y: 20 },
    moving: false,
  });
});
