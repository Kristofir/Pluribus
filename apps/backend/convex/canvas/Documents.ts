import type { CanvasDocuments } from "@pluribus/core/canvas/documents";
import type { DocumentElementId } from "@pluribus/core/canvas/domain";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
export const toDocumentElementId = (id: Id<"canvasDocuments">) =>
  id as string as DocumentElementId;
export function canvasDocuments(ctx: MutationCtx): CanvasDocuments {
  const stored = (id: DocumentElementId) => {
    const value = ctx.db.normalizeId("canvasDocuments", id);
    if (!value) throw new Error("Invalid child ID");
    return value;
  };
  return {
    count: async () =>
      (
        await ctx.db
          .query("canvasDocuments")
          .withIndex("by_canvas_removed", (q) =>
            q.eq("canvas", "shared").eq("removed", false),
          )
          .take(2)
      ).length,
    insert: async (geometry) =>
      toDocumentElementId(
        await ctx.db.insert("canvasDocuments", {
          ...geometry,
          canvas: "shared",
          removed: false,
          generation: 1,
        }),
      ),
    attach: async (id, document) => {
      const docId = ctx.db.normalizeId("documents", document);
      if (!docId) throw new Error("Invalid document");
      await ctx.db.patch(stored(id), { documentId: docId });
    },
    get: async (id) => {
      const row = await ctx.db.get(stored(id));
      return row && row.canvas === "shared"
        ? { id, generation: row.generation, removed: row.removed }
        : null;
    },
    geometry: async (id, geometry) => {
      await ctx.db.patch(stored(id), geometry);
    },
    lifecycle: async (id, removed, generation) => {
      await ctx.db.patch(stored(id), {
        removed,
        generation,
        activeDeletion: undefined,
      });
    },
  };
}
