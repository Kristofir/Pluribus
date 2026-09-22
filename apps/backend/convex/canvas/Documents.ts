import { documentLimits } from "@pluribus/core/canvas/domain";
import type { CanvasDocuments } from "@pluribus/core/canvas/documents";
import type { DocumentElementId } from "@pluribus/core/canvas/domain";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
export const toDocumentElementId = (id: Id<"canvasDocuments">) =>
  id as string as DocumentElementId;
export function canvasDocuments(
  ctx: MutationCtx,
  workspaceId?: Id<"workspaces">,
): CanvasDocuments {
  const stored = (id: DocumentElementId) => {
    const value = ctx.db.normalizeId("canvasDocuments", id);
    if (!value) throw new Error("Invalid child ID");
    return value;
  };
  return {
    count: async () =>
      (
        await spatialDocuments(
          ctx,
          workspaceId ?? "shared",
          documentLimits.maxCount,
        )
      ).length,
    insert: async (geometry) =>
      toDocumentElementId(
        await ctx.db.insert("canvasDocuments", {
          ...geometry,
          canvas: workspaceId ?? "shared",
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
      return row && "x" in row && row.canvas === (workspaceId ?? "shared")
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

/** Both legacy untagged cards and explicit card roles share capacity; panel children never do. */
export async function spatialDocuments(
  ctx: QueryCtx,
  canvas: string,
  limit: number,
) {
  const legacy = await ctx.db
    .query("canvasDocuments")
    .withIndex("by_canvas_role_removed", (q) =>
      q.eq("canvas", canvas).eq("role", undefined).eq("removed", false),
    )
    .take(limit);
  if (legacy.length >= limit) return legacy;
  const cards = await ctx.db
    .query("canvasDocuments")
    .withIndex("by_canvas_role_removed", (q) =>
      q.eq("canvas", canvas).eq("role", "card").eq("removed", false),
    )
    .take(limit - legacy.length);
  return [...legacy, ...cards];
}
