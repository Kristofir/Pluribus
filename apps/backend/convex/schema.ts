import { message, sendStatus } from "./inbox/Model";
import { sourceStatus, capture, sourceTable } from "./sources/Model";
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
  workspaceInboxProvisioning: defineTable({
    workspaceId: v.id("workspaces"),
    clientId: v.string(),
    revision: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),
  workspaceInboxes: defineTable({
    workspaceId: v.id("workspaces"),
    providerInboxId: v.string(),
    revision: v.number(),
    status: v.union(
      v.literal("idle"),
      v.literal("loading"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_provider", ["providerInboxId"]),
  inboxThreads: defineTable({
    workspaceId: v.id("workspaces"),
    inboxId: v.id("workspaceInboxes"),
    providerId: v.string(),
    subject: v.string(),
    messages: v.array(message),
    truncated: v.boolean(),
    draftDocumentId: v.optional(v.id("documents")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_inbox_provider", ["inboxId", "providerId"]),
  sendIntents: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    threadId: v.id("inboxThreads"),
    inboxId: v.id("workspaceInboxes"),
    providerMessageId: v.string(),
    documentId: v.id("documents"),
    generation: v.number(),
    requestId: v.string(),
    draftVersion: v.number(),
    text: v.string(),
    recipients: v.array(v.string()),
    status: sendStatus,
    reconciling: v.optional(v.boolean()),
    reconcileRevision: v.optional(v.number()),
    error: v.optional(v.string()),
    sentMessageId: v.optional(v.string()),
  })
    .index("by_user_request", ["userId", "requestId"])
    .index("by_thread", ["threadId"]),
  sourceScreenshotAssets: defineTable({
    storageId: v.id("_storage"),
    accepted: v.boolean(),
  }).index("by_storage", ["storageId"]),
  sources: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    url: v.string(),
    prompt: v.optional(v.string()),
    table: v.optional(sourceTable),
    status: sourceStatus,
    geometry: v.optional(geometry),
    generation: v.optional(v.number()),
    removed: v.optional(v.literal(true)),
    activeDeletion: v.optional(v.string()),
    revision: v.number(),
    deadlineAt: v.optional(v.number()),
    capture: v.optional(capture),
    error: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_removed", ["workspaceId", "removed"]),
  agentGrants: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    documentIds: v.array(v.id("documents")),
    tokenHash: v.string(),
    revoked: v.boolean(),
    label: v.string(),
  })
    .index("by_token", ["tokenHash"])
    .index("by_workspace_user", ["workspaceId", "userId"]),
  agentContexts: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    documentIds: v.array(v.id("documents")),
    content: v.string(),
  }).index("by_workspace_user", ["workspaceId", "userId"]),
  agentChanges: defineTable({
    workspaceId: v.id("workspaces"),
    documentId: v.id("documents"),
    generation: v.number(),
    grantId: v.id("agentGrants"),
    userId: v.id("users"),
    author: v.id("documentAuthors"),
    session: v.id("documentAuthorSessions"),
    operations: v.array(v.string()),
    createdParagraphIds: v.optional(v.array(v.string())),
    createdStructures: v.optional(
      v.array(
        v.object({ id: v.string(), type: v.string(), attrs: v.string() }),
      ),
    ),
    version: v.number(),
    undone: v.boolean(),
  })
    .index("by_document", ["documentId"])
    .index("by_workspace", ["workspaceId"]),
  agentRequests: defineTable({
    grantId: v.id("agentGrants"),
    requestId: v.string(),
    fingerprint: v.string(),
    result: v.union(
      v.object({
        status: v.literal("applied"),
        version: v.number(),
        operationGroupId: v.id("agentChanges"),
      }),
      v.object({ status: v.literal("conflict"), currentVersion: v.number() }),
    ),
  }).index("by_grant_request", ["grantId", "requestId"]),
  agentUndoRequests: defineTable({
    userId: v.id("users"),
    requestId: v.string(),
    changeId: v.id("agentChanges"),
    version: v.number(),
  }).index("by_user_request", ["userId", "requestId"]),
  documentLinks: defineTable({
    workspaceId: v.id("workspaces"),
    elementId: v.union(
      v.id("rectangles"),
      v.id("canvasDocuments"),
      v.id("sources"),
    ),
    documentId: v.id("documents"),
    paragraphId: v.string(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_element", ["elementId"]),
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    mainDocumentId: v.optional(v.id("documents")),
  }).index("by_slug", ["slug"]),
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"]),
  workspaceAssignments: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    admin: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_workspace_email", ["workspaceId", "email"]),
  administrators: defineTable({ userId: v.id("users") }).index("by_user", [
    "userId",
  ]),
  documentAuthors: defineTable({
    kind: v.union(v.literal("guest"), v.literal("user"), v.literal("agent")),
    userId: v.optional(v.id("users")),
    grantId: v.optional(v.id("agentGrants")),
    secretHash: v.optional(v.string()),
    label: v.string(),
  }).index("by_user", ["userId"]),
  documentAuthorSessions: defineTable({
    author: v.id("documentAuthors"),
    scope: v.string(),
    secretHash: v.string(),
  }).index("by_scope_author", ["scope", "author"]),
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
  })
    .index("by_document_operation", ["document", "operation"])
    .index("by_document_author", ["document", "author"]),
  presenceParticipations: defineTable(participation).index("by_contextKey", [
    "contextKey",
  ]),
  presenceActivity: defineTable(storedActivity).index(
    "by_participationId_and_channel",
    ["participationId", "channel"],
  ),
  canvasHistorySessions: defineTable({
    nonce: v.string(),
    scope: v.string(),
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
    v.union(
      geometry.extend({
        activeDeletion: v.optional(v.string()),
        canvas: v.string(),
        documentId: v.optional(v.id("documents")),
        removed: v.boolean(),
        generation: v.number(),
        role: v.optional(v.literal("card")),
      }),
      v.object({
        canvas: v.string(),
        documentId: v.id("documents"),
        removed: v.boolean(),
        generation: v.number(),
        role: v.literal("main"),
      }),
      v.object({
        canvas: v.string(),
        documentId: v.id("documents"),
        removed: v.boolean(),
        generation: v.number(),
        role: v.literal("reply"),
        threadId: v.id("inboxThreads"),
      }),
    ),
  )
    .index("by_canvas", ["canvas"])
    .index("by_canvas_removed", ["canvas", "removed"])
    .index("by_canvas_role_removed", ["canvas", "role", "removed"]),
  documents: defineTable({
    element: v.optional(v.id("canvasDocuments")),
    key: v.string(),
    access: v.union(v.literal("public"), v.literal("workspace")),
    workspaceId: v.optional(v.id("workspaces")),
    authorship: v.optional(v.literal(1)),
    paragraphs: v.optional(v.literal(1)),
  }).index("by_key", ["key"]),
  rectangles: defineTable(
    rectangle.extend({
      workspaceId: v.optional(v.id("workspaces")),
      activeDeletion: v.optional(v.string()),
      generation: v.optional(v.number()),
      removed: v.optional(v.literal(true)),
    }),
  )
    .index("by_removed", ["removed"])
    .index("by_workspace_removed", ["workspaceId", "removed"]),
});
