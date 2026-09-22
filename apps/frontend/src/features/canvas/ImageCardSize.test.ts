import { expect, test } from "vitest";
import { assertElementGeometry } from "@pluribus/core/canvas/domain";
import { imageCardSize } from "./ImageCardSize";

test("portrait and landscape images retain their aspect ratio on creation", () => {
  expect(imageCardSize(768, 1024)).toEqual({ width: 270, height: 360 });
  expect(imageCardSize(1024, 768)).toEqual({ width: 360, height: 270 });
  expect(imageCardSize(1200, 400)).toEqual({ width: 480, height: 160 });
});

test("extreme image dimensions remain valid canvas geometry", () => {
  for (const [width, height] of [
    [10_000, 100],
    [100, 10_000],
    [1, 1],
  ]) {
    const size = imageCardSize(width, height);
    expect(() => assertElementGeometry({ x: 0, y: 0, ...size })).not.toThrow();
  }
});
