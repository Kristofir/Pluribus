import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireWorkspace } from "./workspaces/Access";
import { requireDocument } from "./documents/Access";
import { hashSecret } from "./documents/Authors";
import { prepareContext } from "./agentAccess/Context";
import { undoAgentChange } from "./agentAccess/Undo";
export const grant = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    documentIds: v.array(v.id("documents")),
    label: v.string(),
  },
  returns: v.object({ grantId: v.id("agentGrants"), token: v.string() }),
  handler: async (ctx, args) => {
    const { userId } = await requireWorkspace(ctx, args.workspaceId);
    if (
      !args.documentIds.length ||
      args.documentIds.length > 20 ||
      !args.label.trim() ||
      args.label.length > 80
    )
      throw new Error("Invalid agent grant");
    for (const id of args.documentIds) {
      const doc = await requireDocument(ctx, id);
      if (doc.workspaceId !== args.workspaceId)
        throw new Error("Document outside workspace");
    }
    const token = crypto.randomUUID() + crypto.randomUUID();
    const grantId = await ctx.db.insert("agentGrants", {
      workspaceId: args.workspaceId,
      userId,
      documentIds: [...new Set(args.documentIds)],
      label: args.label,
      tokenHash: await hashSecret(token),
      revoked: false,
    });
    return { grantId, token };
  },
});
export const revoke = mutation({
  args: { grantId: v.id("agentGrants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const grant = await ctx.db.get(args.grantId);
    if (!grant) throw new Error("Grant unavailable");
    const { userId } = await requireWorkspace(ctx, grant.workspaceId);
    if (userId !== grant.userId)
      throw new Error("Grant belongs to another user");
    await ctx.db.patch(grant._id, { revoked: true });
    return null;
  },
});
export const prepare = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    elementIds: v.array(v.union(v.id("canvasDocuments"), v.id("sources"))),
    passages: v.array(
      v.object({
        documentId: v.id("documents"),
        paragraphId: v.string(),
        version: v.number(),
      }),
    ),
  },
  returns: v.id("agentContexts"),
  handler: prepareContext,
});
export const changes = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({
      id: v.id("agentChanges"),
      documentId: v.id("documents"),
      version: v.number(),
      undone: v.boolean(),
      canUndo: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const { userId } = await requireWorkspace(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("agentChanges")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(50);
    return rows.map((r) => ({
      id: r._id,
      documentId: r.documentId,
      version: r.version,
      undone: r.undone,
      canUndo: !r.undone && r.userId === userId,
    }));
  },
});
export const undo = mutation({
  args: { changeId: v.id("agentChanges"), requestId: v.string() },
  returns: v.object({ version: v.number() }),
  handler: undoAgentChange,
});
export const connectionInfo = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const origin = process.env.CONVEX_SITE_URL;
    return { url: origin ? `${origin.replace(/\/$/, "")}/mcp` : null };
  },
});
