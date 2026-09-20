import type { FunctionReturnType } from "convex/server";
import type { api } from "@pluribus/backend/api";
import type {
  RectangleElement,
  RectangleId,
  DocumentElement,
  DocumentElementId,
} from "@pluribus/core/canvas/domain";
import type { DocumentId } from "@pluribus/core/documents/domain";

/** Convert trusted API projections into the shared element model without copying them into a store. */
export function rectangleElement(
  row: FunctionReturnType<typeof api.Canvas.list>[number],
): RectangleElement {
  return {
    id: row.id as string as RectangleId,
    canvasId: "shared",
    kind: "rectangle",
    geometry: { x: row.x, y: row.y, width: row.width, height: row.height },
    color: row.color,
    generation: row.generation,
    removed: false,
  };
}
export function documentElement(
  row: FunctionReturnType<typeof api.Canvas.documentCards>[number],
): DocumentElement {
  return {
    id: row.id as string as DocumentElementId,
    canvasId: "shared",
    kind: "document",
    geometry: row.geometry,
    documentId: row.documentId as string as DocumentId,
    generation: row.generation,
    removed: row.removed,
  };
}
