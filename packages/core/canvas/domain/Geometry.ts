export type Geometry = { x: number; y: number; width: number; height: number };

/** Shared backend bounds; individual renderers may impose larger minimum sizes. */
export const geometryLimits = {
  minSize: 40,
  maxSize: 2000,
  maxCoordinate: 100000,
} as const;

export class InvalidElementGeometry extends Error {
  constructor() {
    super("Element geometry is outside the supported limits.");
  }
}
export function assertElementGeometry(value: Geometry): void {
  if (
    ![value.x, value.y, value.width, value.height].every(Number.isFinite) ||
    Math.abs(value.x) > geometryLimits.maxCoordinate ||
    Math.abs(value.y) > geometryLimits.maxCoordinate ||
    value.width < geometryLimits.minSize ||
    value.width > geometryLimits.maxSize ||
    value.height < geometryLimits.minSize ||
    value.height > geometryLimits.maxSize
  )
    throw new InvalidElementGeometry();
}
