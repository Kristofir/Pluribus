import {
  createCanvasDocument,
  changeCanvasDocument,
} from "@pluribus/core/canvas/documents";
import { assertCanvasAccess } from "@pluribus/core/canvas/access";
import { canvasActor } from "./canvas/Actor";
import { canvasDocuments, toDocumentElementId } from "./canvas/Documents";
import { childText } from "./documents/ChildText";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import * as handlers from "./canvas/Handlers";
import { color, geometry, rectangleView } from "./canvas/Model";

/**
 * Public canvas API: keep every client-callable canvas declaration here.
 * Declare args, returns, and the handler explicitly; keep implementation in
 * canvas/ as ordinary functions. Those helpers do not register endpoints.
 * Business rules and write use cases belong in @pluribus/core.
 * Convex still derives API names from this filename and these exports.
 * New public feature entrypoints require the PublicApi.mjs allowlist update.
 */
/**
 * Public reactive canvas projection. Returns the bounded set of shared rectangles
 * that React Flow renders; subscription updates propagate accepted geometry changes.
 */
export const list = query({
  args: {},
  returns: v.array(rectangleView),
  handler: handlers.list,
});

/**
 * Public rectangle-creation contract. The handler derives the actor and invokes
 * the core creation use case, which validates geometry and capacity before writing.
 */
export const create = mutation({
  args: { geometry, color },
  returns: v.id("rectangles"),
  handler: handlers.create,
});

/**
 * Public whole-geometry update contract for drag/resize gestures. Returns false
 * when the record was deleted, preventing a late gesture from recreating it.
 */
export const updateGeometry = mutation({
  args: { id: v.id("rectangles"), geometry },
  returns: v.boolean(),
  handler: handlers.updateGeometry,
});

/**
 * Public idempotent deletion contract. Removes an existing rectangle through the
 * core use case; repeated deletion succeeds without creating or restoring data.
 */
export const remove = mutation({
  args: { id: v.id("rectangles") },
  returns: v.null(),
  handler: handlers.remove,
});

/** Canvas owns child creation/lifecycle; document adapters supply text in the same transaction. */
export const createDocument = mutation({
  args: { geometry },
  returns: v.id("canvasDocuments"),
  handler: async (ctx, args) => {
    const id = await createCanvasDocument(
      await canvasActor(ctx),
      canvasDocuments(ctx),
      childText(ctx),
      args.geometry,
    );
    const stored = ctx.db.normalizeId("canvasDocuments", id);
    if (!stored) throw new Error("Invalid child");
    return stored;
  },
});
export const documentCards = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("canvasDocuments"),
      documentId: v.id("documents"),
      geometry,
      generation: v.number(),
      removed: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    assertCanvasAccess(await canvasActor(ctx));
    const rows = await ctx.db
      .query("canvasDocuments")
      .withIndex("by_canvas", (q) => q.eq("canvas", "shared"))
      .take(2);
    return rows.map((r) => {
      if (!r.documentId) throw new Error("Incomplete document child");
      return {
        id: r._id,
        documentId: r.documentId,
        geometry: { x: r.x, y: r.y, width: r.width, height: r.height },
        generation: r.generation,
        removed: r.removed,
      };
    });
  },
});
export const changeDocument = mutation({
  args: {
    id: v.id("canvasDocuments"),
    generation: v.number(),
    change: v.union(
      v.object({ kind: v.literal("geometry"), geometry }),
      v.object({ kind: v.union(v.literal("remove"), v.literal("restore")) }),
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) =>
    changeCanvasDocument(
      await canvasActor(ctx),
      canvasDocuments(ctx),
      toDocumentElementId(args.id),
      args.generation,
      args.change,
    ),
});
