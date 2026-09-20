import {
  actionPayload,
  actionState,
  historyOutcome,
  elementId,
} from "./canvas/HistoryModel";
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { participation, storedActivity } from "./presence/Model";
import { rectangle, geometry } from "./canvas/Model";

/**
 * Application-owned storage contract. Auth tables are library-managed; canvas
 * geometry and document identity belong to this app. Collaborative text bodies
 * live in the ProseMirror Sync component, not the documents table.
 */
export default defineSchema({
  ...authTables,
  documentAuthors: defineTable({
    kind: v.union(v.literal("guest"), v.literal("user")),
    userId: v.optional(v.id("users")),
    secretHash: v.optional(v.string()),
    label: v.string(),
  }).index("by_user", ["userId"]),
  documentAuthorSessions: defineTable({
    author: v.id("documentAuthors"),
    scope: v.string(),
    secretHash: v.string(),
  }),
  documentOperations: defineTable({
    document: v.id("documents"),
    scope: v.string(),
    operation: v.string(),
    author: v.id("documentAuthors"),
    session: v.id("documentAuthorSessions"),
    version: v.number(),
    inverse: v.string(),
    moveGroup: v.optional(v.string()),
    movePart: v.optional(v.union(v.literal("remove"), v.literal("insert"))),
    revertedBy: v.optional(v.string()),
    undoOf: v.optional(v.string()),
  }).index("by_document_operation", ["document", "operation"]),
  presenceParticipations: defineTable(participation).index("by_contextKey", [
    "contextKey",
  ]),
  presenceActivity: defineTable(storedActivity).index(
    "by_participationId_and_channel",
    ["participationId", "channel"],
  ),
  canvasHistorySessions: defineTable({
    nonce: v.string(),
    scope: v.literal("shared"),
    owner: v.union(v.string(), v.null()),
    proof: v.string(),
    version: v.literal(2),
  }).index("by_nonce", ["nonce"]),
  canvasHistoryActions: defineTable({
    session: v.id("canvasHistorySessions"),
    action: v.string(),
    version: v.literal(2),
    state: actionState,
    revision: v.number(),
    payload: actionPayload,
  }).index("by_session_action", ["session", "action"]),
  canvasHistoryAttempts: defineTable({
    session: v.id("canvasHistorySessions"),
    attempt: v.string(),
    fingerprint: v.string(),
    outcome: historyOutcome,
  }).index("by_session_attempt", ["session", "attempt"]),
  canvasHistoryTargets: defineTable({
    session: v.id("canvasHistorySessions"),
    element: elementId,
    lineage: v.string(),
    generation: v.number(),
    removed: v.boolean(),
  }).index("by_session_element", ["session", "element"]),
  canvasGeometryOperations: defineTable({
    operation: v.string(),
    owner: v.union(v.string(), v.null()),
    proof: v.string(),
    sequence: v.number(),
    revision: v.number(),
    closed: v.boolean(),
    undone: v.boolean(),
    changes: v.array(
      v.object({
        id: v.union(v.id("rectangles"), v.id("canvasDocuments")),
        generation: v.number(),
        before: geometry,
        after: geometry,
      }),
    ),
  }).index("by_operation", ["operation"]),
  canvasCreations: defineTable({
    operation: v.string(),
    owner: v.union(v.string(), v.null()),
    proof: v.string(),
    request: v.string(),
    element: v.union(v.id("rectangles"), v.id("canvasDocuments")),
  }).index("by_operation", ["operation"]),
  canvasDeletions: defineTable({
    operation: v.string(),
    element: v.union(v.id("canvasDocuments"), v.id("rectangles")),
    generation: v.number(),
    owner: v.union(v.string(), v.null()),
    proof: v.string(),
    restoredGeneration: v.optional(v.number()),
  })
    .index("by_operation", ["operation"])
    .index("by_element", ["element"]),
  canvasDocuments: defineTable(
    geometry.extend({
      activeDeletion: v.optional(v.string()),
      canvas: v.literal("shared"),
      documentId: v.optional(v.id("documents")),
      removed: v.boolean(),
      generation: v.number(),
    }),
  )
    .index("by_canvas", ["canvas"])
    .index("by_canvas_removed", ["canvas", "removed"]),
  documents: defineTable({
    element: v.optional(v.id("canvasDocuments")),
    key: v.string(),
    access: v.literal("public"),
    authorship: v.optional(v.literal(1)),
  }).index("by_key", ["key"]),
  rectangles: defineTable(
    rectangle.extend({
      activeDeletion: v.optional(v.string()),
      generation: v.optional(v.number()),
      removed: v.optional(v.literal(true)),
    }),
  ).index("by_removed", ["removed"]),
});
