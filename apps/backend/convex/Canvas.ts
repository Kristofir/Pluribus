import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import * as handlers from "./canvas/Handlers";
import * as deletions from "./canvas/Deletions";
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
  handler: handlers.createDocument,
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
  handler: handlers.documentCards,
});
export const changeDocument = mutation({
  args: {
    id: v.id("canvasDocuments"),
    generation: v.number(),
    change: v.object({ kind: v.literal("geometry"), geometry }),
  },
  returns: v.boolean(),
  handler: handlers.changeDocument,
});

const deletionResult = v.object({
  status: v.union(
    v.literal("deleted"),
    v.literal("restored"),
    v.literal("conflict"),
    v.literal("full"),
  ),
  generation: v.number(),
});
/** Personal deletion history uses a capability and trusted server-side recovery data. */
export const deleteDocument = mutation({
  args: {
    id: v.id("canvasDocuments"),
    generation: v.number(),
    operation: v.string(),
    secret: v.string(),
  },
  returns: deletionResult,
  handler: deletions.deleteDocument,
});
export const undoDeletion = mutation({
  args: { operation: v.string(), secret: v.string() },
  returns: deletionResult,
  handler: deletions.undoDeletion,
});
