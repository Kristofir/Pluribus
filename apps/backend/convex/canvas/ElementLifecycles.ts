import type { ElementLifecycles } from "@pluribus/core/canvas/deletions";
import { type ElementId } from "@pluribus/core/canvas/domain";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { canvasDocuments, toDocumentElementId } from "./Documents";

export function toElementId(
  id: Id<"rectangles"> | Id<"canvasDocuments"> | Id<"sources">,
): ElementId {
  return id as string as ElementId;
}

/** Route lifecycle storage by validated table identity; core owns deletion policy. */
export function elementLifecycles(ctx: MutationCtx): ElementLifecycles {
  const documents = canvasDocuments(ctx);
  const counts = {
    source: () => Promise.resolve(0),
    rectangle: () => Promise.resolve(0),
    document: () => documents.count(),
  };
  return {
    async get(id) {
      const rectangle = ctx.db.normalizeId("rectangles", id);
      if (rectangle) return null;
      const document = ctx.db.normalizeId("canvasDocuments", id);
      if (!document) throw new Error("Invalid Element ID");
      const value = await documents.get(toDocumentElementId(document));
      return value ? { ...value, kind: "document" } : null;
    },
    async lifecycle(id, removed, generation) {
      const rectangle = ctx.db.normalizeId("rectangles", id);
      if (rectangle) throw new Error("Rectangle elements are retired");
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
