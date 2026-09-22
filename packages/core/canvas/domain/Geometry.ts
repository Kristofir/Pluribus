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

/** Documents can grow vertically with their content; rectangle bounds stay unchanged. */
export function assertDocumentGeometry(value: Geometry): void {
  assertElementGeometry({ ...value, height: geometryLimits.minSize });
  if (!Number.isFinite(value.height) || value.height < geometryLimits.minSize)
    throw new InvalidElementGeometry();
}

/** Web Page cards retain the compact design minimum; captures never auto-grow their cards. */
export function assertSourceGeometry(value: Geometry): void {
  assertElementGeometry(value);
  if (value.width < 300 || value.height < 132)
    throw new InvalidElementGeometry();
}
