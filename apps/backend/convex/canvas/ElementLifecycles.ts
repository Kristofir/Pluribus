import type { ElementLifecycles } from "@pluribus/core/canvas/deletions";
import { rectangleLimits, type ElementId } from "@pluribus/core/canvas/domain";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { canvasDocuments, toDocumentElementId } from "./Documents";
import { rectanglePersistence, toRectangleId } from "./Persistence";

export function toElementId(
  id: Id<"rectangles"> | Id<"canvasDocuments">,
): ElementId {
  return id as string as ElementId;
}

/** Route lifecycle storage by validated table identity; core owns deletion policy. */
export function elementLifecycles(ctx: MutationCtx): ElementLifecycles {
  const documents = canvasDocuments(ctx);
  const rectangles = rectanglePersistence(ctx);
  const counts = {
    rectangle: () => rectangles.countUpTo(rectangleLimits.maxCount),
    document: () => documents.count(),
  };
  return {
    async get(id) {
      const rectangle = ctx.db.normalizeId("rectangles", id);
      if (rectangle) return rectangles.get(toRectangleId(rectangle));
      const document = ctx.db.normalizeId("canvasDocuments", id);
      if (!document) throw new Error("Invalid Element ID");
      const value = await documents.get(toDocumentElementId(document));
      return value ? { ...value, kind: "document" } : null;
    },
    async lifecycle(id, removed, generation) {
      const rectangle = ctx.db.normalizeId("rectangles", id);
      if (rectangle)
        return rectangles.lifecycle(
          toRectangleId(rectangle),
          removed,
          generation,
        );
      const document = ctx.db.normalizeId("canvasDocuments", id);
      if (!document) throw new Error("Invalid Element ID");
      return documents.lifecycle(
        toDocumentElementId(document),
        removed,
        generation,
      );
    },
    count: (kind) => counts[kind](),
  };
}
