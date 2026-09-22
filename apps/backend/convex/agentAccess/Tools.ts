import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import { applyArgs, applyResult } from "./Model";
import { applyAgentEdit, readAgentDocument } from "./Edits";
import { readContext } from "./Context";
import { requireGrant } from "./Access";
import { readAgentCanvas, readAgentWebPage } from "./CanvasReads";
import { geometry } from "../canvas/Model";
import { sourceStatus } from "../sources/Model";
import { historyOutcome } from "../canvas/HistoryModel";
import {
  cardId,
  cardInput,
  createAgentCard,
  deleteAgentCard,
  reverseAgentCardAction,
  setAgentCardGeometry,
} from "./CanvasActions";
import { presenceParameters } from "@pluribus/core/presence/domain";
export const authenticate = internalQuery({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireGrant(ctx, args.token);
    return null;
  },
});
/** MCP requests renew a short activity lease; there is no persistent agent connection. */
export const touchPresence = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const grant = await requireGrant(ctx, token);
    const deadline = Date.now() + presenceParameters.agentRecentlyActiveMs;
    await ctx.db.patch(grant._id, { presenceDeadlineAt: deadline });
    if (!grant.presenceDeadlineAt)
      await ctx.scheduler.runAfter(
        presenceParameters.agentRecentlyActiveMs,
        internal.agentAccess.Tools.expirePresence,
        {
          grantId: grant._id,
        },
      );
    return null;
  },
});
/** One scheduled checker follows renewed activity until it expires. */
export const expirePresence = internalMutation({
  args: { grantId: v.id("agentGrants") },
  returns: v.null(),
  handler: async (ctx, { grantId }) => {
    const grant = await ctx.db.get(grantId);
    if (!grant || grant.revoked || !grant.presenceDeadlineAt) return null;
    const remaining = grant.presenceDeadlineAt - Date.now();
    if (remaining > 0)
      await ctx.scheduler.runAfter(
        remaining,
        internal.agentAccess.Tools.expirePresence,
        { grantId },
      );
    else await ctx.db.patch(grantId, { presenceDeadlineAt: undefined });
    return null;
  },
});
export const readDocument = internalQuery({
  args: { token: v.string(), documentId: v.id("documents") },
  returns: v.object({
    documentId: v.id("documents"),
    generation: v.number(),
    version: v.number(),
    paragraphs: v.array(
      v.object({ paragraphId: v.string(), text: v.string() }),
    ),
  }),
  handler: readAgentDocument,
});
export const readCanvas = internalQuery({
  args: { token: v.string() },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    elements: v.array(
      v.union(
        v.object({
          kind: v.literal("document"),
          id: v.id("canvasDocuments"),
          documentId: v.id("documents"),
          geometry,
          generation: v.number(),
          canReadContent: v.boolean(),
        }),
        v.object({
          kind: v.literal("web_page"),
          id: v.id("sources"),
          geometry,
          generation: v.number(),
          url: v.string(),
          status: sourceStatus,
          revision: v.number(),
          title: v.optional(v.string()),
        }),
        v.object({
          kind: v.literal("image"),
          id: v.id("canvasImages"),
          geometry,
          generation: v.number(),
          name: v.string(),
        }),
      ),
    ),
  }),
  handler: readAgentCanvas,
});
export const readWebPage = internalQuery({
  args: { token: v.string(), sourceId: v.id("sources") },
  returns: v.object({
    sourceId: v.id("sources"),
    url: v.string(),
    prompt: v.optional(v.string()),
    status: sourceStatus,
    revision: v.number(),
    error: v.optional(v.string()),
    capture: v.union(
      v.null(),
      v.object({
        id: v.string(),
        capturedAt: v.number(),
        url: v.optional(v.string()),
        title: v.optional(v.string()),
        content: v.string(),
        data: v.optional(v.string()),
        extractionFormat: v.optional(v.literal("inferred-v1")),
      }),
    ),
  }),
  handler: readAgentWebPage,
});
export const applyEdit = internalMutation({
  args: applyArgs,
  returns: applyResult,
  handler: applyAgentEdit,
});
export const createCard = internalMutation({
  args: { token: v.string(), requestId: v.string(), card: cardInput },
  returns: historyOutcome,
  handler: createAgentCard,
});
export const setCardGeometry = internalMutation({
  args: {
    token: v.string(),
    requestId: v.string(),
    id: cardId,
    generation: v.number(),
    expectedGeometry: geometry,
    geometry,
  },
  returns: historyOutcome,
  handler: setAgentCardGeometry,
});
export const deleteCard = internalMutation({
  args: {
    token: v.string(),
    requestId: v.string(),
    id: cardId,
    generation: v.number(),
  },
  returns: historyOutcome,
  handler: deleteAgentCard,
});
export const reverseCardAction = internalMutation({
  args: {
    token: v.string(),
    actionId: v.string(),
    requestId: v.string(),
    revision: v.number(),
    undo: v.boolean(),
  },
  returns: historyOutcome,
  handler: reverseAgentCardAction,
});
export const context = internalQuery({
  args: { token: v.string(), contextSnapshotId: v.id("agentContexts") },
  returns: v.string(),
  handler: readContext,
});
