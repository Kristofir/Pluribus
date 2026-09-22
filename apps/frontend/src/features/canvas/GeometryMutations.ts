import type { FunctionArgs } from "convex/server";
import type { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import type {
  CanvasElement,
  DocumentElement,
  SourceElement,
  ImageElement,
  Geometry,
} from "@pluribus/core/canvas/domain";

export type GeometryTarget = Pick<
  DocumentElement | SourceElement | ImageElement,
  "kind" | "id" | "generation"
>;
type Mutations = {
  source?: (
    args: Omit<FunctionArgs<typeof api.Sources.changeGeometry>, "workspaceId">,
  ) => Promise<boolean>;
  image?: (
    args: Omit<FunctionArgs<typeof api.Canvas.changeImage>, "workspaceId">,
  ) => Promise<boolean>;
  document: (
    args: FunctionArgs<typeof api.Canvas.changeDocument>,
  ) => Promise<boolean>;
};
/** Capture routing and generation when the gesture starts; queued writes never adopt a restored generation. */
export function geometryTarget(element: CanvasElement): GeometryTarget {
  switch (element.kind) {
    case "rectangle":
      throw new Error("Rectangle elements are retired");
    case "source":
    case "image":
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
    case "source":
      return (
        mutations.source?.({
          id: target.id as string as Id<"sources">,
          generation: target.generation,
          geometry,
        }) ?? Promise.resolve(false)
      );
    case "document":
      return mutations.document({
        id: target.id as string as Id<"canvasDocuments">,
        generation: target.generation,
        change: { kind: "geometry", geometry },
      });
    case "image":
      return (
        mutations.image?.({
          id: target.id as string as Id<"canvasImages">,
          generation: target.generation,
          geometry,
        }) ?? Promise.resolve(false)
      );
    default:
      return Promise.resolve(false);
  }
}
function unexpectedElement(_element: never): never {
  throw new Error("Unsupported canvas element kind");
}
