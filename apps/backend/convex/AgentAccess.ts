import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireWorkspace } from "./workspaces/Access";
import { hashSecret } from "./documents/Authors";
import { prepareContext } from "./agentAccess/Context";
import { undoAgentChange } from "./agentAccess/Undo";
export const grant = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    label: v.string(),
  },
  returns: v.object({ grantId: v.id("agentGrants"), token: v.string() }),
  handler: async (ctx, args) => {
    const { userId } = await requireWorkspace(ctx, args.workspaceId);
    if (!args.label.trim() || args.label.length > 80)
      throw new Error("Invalid agent grant");
    const active = await ctx.db
      .query("agentGrants")
      .withIndex("by_workspace_revoked", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("revoked", false),
      )
      .take(32);
    if (active.length >= 32)
      throw new Error("Agent connection capacity reached");
    const token = crypto.randomUUID() + crypto.randomUUID();
    const grantId = await ctx.db.insert("agentGrants", {
      workspaceId: args.workspaceId,
      userId,
      documentIds: [],
      workspaceScope: true,
      label: args.label,
      tokenHash: await hashSecret(token),
      revoked: false,
    });
    const authorId = await ctx.db.insert("documentAuthors", {
      kind: "agent",
      grantId,
      label: args.label,
    });
    await ctx.db.patch(grantId, { authorId });
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
    await ctx.db.patch(grant._id, {
      revoked: true,
      presenceDeadlineAt: undefined,
    });
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
      author: v.string(),
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
    return Promise.all(
      rows.map(async (r) => ({
        id: r._id,
        author: (await ctx.db.get(r.author))?.label ?? "External agent",
        documentId: r.documentId,
        version: r.version,
        undone: r.undone,
        canUndo: !r.undone && r.userId === userId,
      })),
    );
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
