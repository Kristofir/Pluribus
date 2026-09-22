import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { applyArgs, applyResult } from "./Model";
import { applyAgentEdit, readAgentDocument } from "./Edits";
import { readContext } from "./Context";
import { requireGrant } from "./Access";
export const authenticate = internalQuery({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireGrant(ctx, args.token);
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
export const applyEdit = internalMutation({
  args: applyArgs,
  returns: applyResult,
  handler: applyAgentEdit,
});
export const context = internalQuery({
  args: { token: v.string(), contextSnapshotId: v.id("agentContexts") },
  returns: v.string(),
  handler: readContext,
});
