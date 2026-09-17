import type { RectanglePersistence } from "@pluribus/core/canvas/application";
import type { RectangleId } from "@pluribus/core/canvas/domain";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// The caller supplies a Convex-validated table ID, or an ID returned by db.insert.
export function toRectangleId(id: Id<"rectangles">): RectangleId {
  return id as string as RectangleId;
}

/**
 * Build the core canvas storage port for this mutation. All methods share its
 * transaction; never retain the context or hide external network effects.
 */
export function rectanglePersistence(ctx: MutationCtx): RectanglePersistence {
  function storageId(id: RectangleId): Id<"rectangles"> {
    const normalized = ctx.db.normalizeId("rectangles", id);
    if (!normalized) throw new Error("Invalid rectangle ID.");
    return normalized;
  }
  return {
    countUpTo: async (limit) =>
      (
        await ctx.db
          .query("rectangles")
          .withIndex("by_creation_time")
          .take(limit)
      ).length,
    get: async (id) => {
      const record = await ctx.db.get("rectangles", storageId(id));
      if (!record) return null;
      const { x, y, width, height, color } = record;
      return {
        id,
        kind: "rectangle",
        canvasId: "shared",
        geometry: { x, y, width, height },
        color,
      };
    },
    insert: async ({ geometry, color }) =>
      toRectangleId(await ctx.db.insert("rectangles", { ...geometry, color })),
    updateGeometry: (id, geometry) =>
      ctx.db.patch("rectangles", storageId(id), geometry),
    remove: (id) => ctx.db.delete("rectangles", storageId(id)),
  };
}
