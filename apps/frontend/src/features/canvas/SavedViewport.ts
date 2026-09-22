import type { Viewport } from "@xyflow/react";
export function readViewport(
  key: string,
  width: number,
  height: number,
): Viewport | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      !value ||
      ![value.centerX, value.centerY, value.zoom].every(Number.isFinite) ||
      value.zoom < 0.1 ||
      value.zoom > 3
    )
      return null;
    return {
      x: width / 2 - value.centerX * value.zoom,
      y: height / 2 - value.centerY * value.zoom,
      zoom: value.zoom,
    };
  } catch {
    return null;
  }
}
export function saveViewport(
  key: string,
  viewport: Viewport,
  width: number,
  height: number,
) {
  if (!width || !height) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        centerX: (width / 2 - viewport.x) / viewport.zoom,
        centerY: (height / 2 - viewport.y) / viewport.zoom,
        zoom: viewport.zoom,
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}
