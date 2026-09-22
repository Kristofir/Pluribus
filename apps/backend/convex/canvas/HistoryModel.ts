import { sourceTable } from "../sources/Model";
import { v } from "convex/values";
import { geometry, color } from "./Model";
export const elementId = v.union(
  v.id("rectangles"),
  v.id("canvasDocuments"),
  v.id("sources"),
);
const target = { id: elementId, lineage: v.string() };
const lifecycle = {
  ...target,
  deletion: v.union(v.string(), v.null()),
  deletedGeneration: v.union(v.number(), v.null()),
};
export const actionPayload = v.union(
  v.object({ kind: v.literal("create"), ...lifecycle }),
  v.object({ kind: v.literal("delete"), ...lifecycle }),
  v.object({
    kind: v.literal("geometry"),
    changes: v.array(
      v.object({
        ...target,
        generation: v.number(),
        before: geometry,
        after: geometry,
      }),
    ),
    sequence: v.number(),
    fingerprint: v.string(),
    deadline: v.number(),
  }),
);
export const actionState = v.union(
  v.literal("open"),
  v.literal("applied"),
  v.literal("undone"),
  v.literal("noop"),
);
export const historyOutcome = v.object({
  status: v.union(
    v.literal("applied"),
    v.literal("noop"),
    v.literal("blocked"),
    v.literal("obsolete"),
    v.literal("rejected"),
    v.literal("reconcile"),
  ),
  action: v.string(),
  revision: v.number(),
  id: v.union(elementId, v.null()),
  sequence: v.number(),
  message: v.union(v.string(), v.null()),
});
export const historyAuth = {
  session: v.id("canvasHistorySessions"),
  secret: v.string(),
};
export const historyRequest = {
  ...historyAuth,
  action: v.string(),
  attempt: v.string(),
};
export const actionInput = v.union(
  v.object({
    kind: v.literal("create"),
    element: v.union(
      v.object({ kind: v.literal("rectangle"), geometry, color }),
      v.object({ kind: v.literal("document"), geometry }),
      v.object({
        kind: v.literal("source"),
        geometry,
        url: v.string(),
        prompt: v.optional(v.string()),
        table: v.optional(sourceTable),
      }),
    ),
  }),
  v.object({
    kind: v.literal("delete"),
    id: elementId,
    generation: v.number(),
  }),
);
export const geometryUpdates = v.array(
  v.object({ id: elementId, generation: v.number(), geometry }),
);
export const gestureAck = v.object({
  status: v.union(
    v.literal("accepted"),
    v.literal("superseded"),
    v.literal("closed"),
    v.literal("conflict"),
  ),
  sequence: v.number(),
});
export const historySummary = v.union(
  v.null(),
  v.object({
    action: v.string(),
    state: actionState,
    revision: v.number(),
    sequence: v.number(),
    reversible: v.boolean(),
  }),
);
