import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/** One-time compatibility recovery: old placeholders have no personal deletion receipt. */
export const restoreLegacy = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const active = await ctx.db
      .query("canvasDocuments")
      .withIndex("by_canvas_removed", (q) =>
        q.eq("canvas", "shared").eq("removed", false),
      )
      .take(2);
    const candidates = await ctx.db
      .query("canvasDocuments")
      .withIndex("by_canvas_removed", (q) =>
        q.eq("canvas", "shared").eq("removed", true),
      )
      .take(2);
    let restored = 0;
    for (const child of candidates) {
      if (active.length + restored >= 2) break;
      const receipt = await ctx.db
        .query("canvasDeletions")
        .withIndex("by_element", (q) => q.eq("element", child._id))
        .first();
      if (receipt || !("x" in child) || child.activeDeletion) continue;
      await ctx.db.patch(child._id, {
        removed: false,
        generation: child.generation + 1,
      });
      restored++;
    }
    return restored;
  },
});
