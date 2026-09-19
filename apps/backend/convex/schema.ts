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
  canvasDeletions: defineTable({
    operation: v.string(),
    element: v.id("canvasDocuments"),
    generation: v.number(),
    owner: v.union(v.string(), v.null()),
    proof: v.string(),
    restoredGeneration: v.optional(v.number()),
  })
    .index("by_operation", ["operation"])
    .index("by_element", ["element"]),
  canvasDocuments: defineTable(
    geometry.extend({
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
  rectangles: defineTable(rectangle),
});
