import * as history from "./canvas/History";
import * as historyModel from "./canvas/HistoryModel";
import * as creations from "./canvas/Creations";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import * as handlers from "./canvas/Handlers";
import * as geometryHistory from "./canvas/GeometryHistory";
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
  args: { id: v.id("rectangles"), generation: v.number(), geometry },
  returns: v.boolean(),
  handler: handlers.updateGeometry,
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

/** Element deletion shares one receipt and lifecycle policy across supported types. */
export const deleteElement = mutation({
  args: {
    id: v.union(v.id("canvasDocuments"), v.id("rectangles")),
    generation: v.number(),
    operation: v.string(),
    secret: v.string(),
  },
  returns: deletionResult,
  handler: deletions.deleteElement,
});

const geometryResult = v.object({
  status: v.union(
    v.literal("applied"),
    v.literal("conflict"),
    v.literal("unchanged"),
  ),
  revision: v.number(),
});
/** Stream a gesture under one identity; finalize it before entering personal History. */
export const applyGeometry = mutation({
  args: {
    operation: v.string(),
    secret: v.string(),
    sequence: v.number(),
    final: v.boolean(),
    updates: v.array(
      v.object({
        id: v.union(v.id("rectangles"), v.id("canvasDocuments")),
        generation: v.number(),
        geometry,
      }),
    ),
  },
  returns: geometryResult,
  handler: geometryHistory.applyGeometry,
});
/** Undo/Redo is conditional on the whole group's saved geometry and generation. */
export const reverseGeometry = mutation({
  args: {
    operation: v.string(),
    secret: v.string(),
    revision: v.number(),
    undo: v.boolean(),
  },
  returns: geometryResult,
  handler: geometryHistory.reverseGeometry,
});

/** Receipt-backed creation used by personal Element History. */
export const createElement = mutation({
  args: {
    operation: v.string(),
    secret: v.string(),
    element: creations.creation,
  },
  returns: v.object({
    status: v.union(
      v.literal("created"),
      v.literal("conflict"),
      v.literal("full"),
    ),
    id: v.union(v.id("rectangles"), v.id("canvasDocuments"), v.null()),
    generation: v.number(),
  }),
  handler: creations.createElement,
});

/** V2 History: session-scoped actions with stable attempt acknowledgements. */
export const openHistorySession = mutation({
  args: { nonce: v.string(), secret: v.string() },
  returns: v.id("canvasHistorySessions"),
  handler: history.openSession,
});
export const applyHistoryAction = mutation({
  args: { ...historyModel.historyRequest, input: historyModel.actionInput },
  returns: historyModel.historyOutcome,
  handler: history.applyAction,
});
export const reverseHistoryAction = mutation({
  args: {
    ...historyModel.historyRequest,
    undo: v.boolean(),
    revision: v.number(),
  },
  returns: historyModel.historyOutcome,
  handler: history.reverseAction,
});
export const updateHistoryGesture = mutation({
  args: {
    ...historyModel.historyAuth,
    action: v.string(),
    sequence: v.number(),
    updates: historyModel.geometryUpdates,
  },
  returns: historyModel.gestureAck,
  handler: history.updateGeometry,
});
export const closeHistoryGesture = mutation({
  args: { ...historyModel.historyRequest, sequence: v.number() },
  returns: historyModel.historyOutcome,
  handler: history.closeGesture,
});
export const heartbeatHistoryGesture = mutation({
  args: { ...historyModel.historyAuth, action: v.string() },
  returns: v.boolean(),
  handler: history.heartbeat,
});
export const readHistoryAction = query({
  args: { ...historyModel.historyAuth, action: v.string() },
  returns: historyModel.historySummary,
  handler: history.readAction,
});
