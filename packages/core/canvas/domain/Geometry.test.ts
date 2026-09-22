import { expect, test } from "vitest";
import {
  assertElementGeometry,
  assertSourceGeometry,
  assertDocumentGeometry,
  InvalidElementGeometry,
  geometryLimits,
} from "./Geometry";
test("geometry includes finite coordinates and the supported size boundaries", () => {
  expect(() =>
    assertElementGeometry({
      x: -geometryLimits.maxCoordinate,
      y: geometryLimits.maxCoordinate,
      width: geometryLimits.minSize,
      height: geometryLimits.maxSize,
    }),
  ).not.toThrow();
  for (const geometry of [
    { x: NaN, y: 0, width: 100, height: 100 },
    { x: 0, y: Infinity, width: 100, height: 100 },
    { x: 0, y: 0, width: 39, height: 100 },
    { x: 0, y: 0, width: 100, height: 2001 },
  ])
    expect(() => assertElementGeometry(geometry)).toThrow(
      InvalidElementGeometry,
    );
});

test("documents allow tall finite heights while retaining width and position limits", () => {
  const geometry = { x: 0, y: 0, width: 430, height: 20000 };
  expect(() => assertDocumentGeometry(geometry)).not.toThrow();
  expect(() => assertElementGeometry(geometry)).toThrow(InvalidElementGeometry);
  for (const height of [NaN, Infinity, -1, 39])
    expect(() => assertDocumentGeometry({ ...geometry, height })).toThrow(
      InvalidElementGeometry,
    );
  expect(() => assertDocumentGeometry({ ...geometry, width: 2001 })).toThrow(
    InvalidElementGeometry,
  );
});

test("web cards accept compact design sizes and retain bounded geometry", () => {
  for (const height of [132, 176, 360])
    expect(() =>
      assertSourceGeometry({ x: 0, y: 0, width: 300, height }),
    ).not.toThrow();
  for (const geometry of [
    { width: 299, height: 176 },
    { width: 300, height: 131 },
    { width: 300, height: 2001 },
  ])
    expect(() => assertSourceGeometry({ x: 0, y: 0, ...geometry })).toThrow(
      InvalidElementGeometry,
    );
});
