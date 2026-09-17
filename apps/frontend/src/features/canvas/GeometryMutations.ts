import type { FunctionArgs } from "convex/server";
import type { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import type {
  CanvasElement,
  RectangleElement,
  DocumentElement,
  Geometry,
} from "@pluribus/core/canvas/domain";

export type GeometryTarget =
  | Pick<RectangleElement, "kind" | "id">
  | Pick<DocumentElement, "kind" | "id" | "generation">;
type Mutations = {
  rectangle: (
    args: FunctionArgs<typeof api.Canvas.updateGeometry>,
  ) => Promise<boolean>;
  document: (
    args: FunctionArgs<typeof api.Canvas.changeDocument>,
  ) => Promise<boolean>;
};
/** Capture routing and generation when the gesture starts; queued writes never adopt a restored generation. */
export function geometryTarget(element: CanvasElement): GeometryTarget {
  switch (element.kind) {
    case "rectangle":
      return { kind: element.kind, id: element.id };
    case "document":
      return {
        kind: element.kind,
        id: element.id,
        generation: element.generation,
      };
    default:
      return unexpectedElement(element);
  }
}
/** API ID conversion stays at this adapter boundary, after narrowing by element kind. */
export function sendGeometry(
  target: GeometryTarget | undefined,
  geometry: Geometry,
  mutations: Mutations,
): Promise<boolean> {
  if (!target) return Promise.resolve(false);
  switch (target.kind) {
    case "rectangle":
      return mutations.rectangle({
        id: target.id as string as Id<"rectangles">,
        geometry,
      });
    case "document":
      return mutations.document({
        id: target.id as string as Id<"canvasDocuments">,
        generation: target.generation,
        change: { kind: "geometry", geometry },
      });
    default:
      return unexpectedElement(target);
  }
}
function unexpectedElement(_element: never): never {
  throw new Error("Unsupported canvas element kind");
}
