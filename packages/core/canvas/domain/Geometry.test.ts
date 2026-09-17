import { expect, test } from "vitest";
import {
  assertElementGeometry,
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
