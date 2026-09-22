import type { FunctionReturnType } from "convex/server";
import type { api } from "@pluribus/backend/api";
import type {
  DocumentElement,
  DocumentElementId,
} from "@pluribus/core/canvas/domain";
import type { DocumentId } from "@pluribus/core/documents/domain";

/** Convert trusted API projections into the shared element model without copying them into a store. */
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
