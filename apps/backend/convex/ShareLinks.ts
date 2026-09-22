import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireWorkspace } from "./workspaces/Access";
import { hashSecret } from "./documents/Authors";

async function requireShare(ctx: QueryCtx, token: string) {
  if (!/^[0-9a-f-]{72}$/.test(token)) throw new Error("Share link unavailable");
  const tokenHash = await hashSecret(token);
  const link = await ctx.db
    .query("workspaceShareLinks")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  const workspace = link ? await ctx.db.get(link.workspaceId) : null;
  if (!link || link.revoked || !workspace || workspace.demo === "landing")
    throw new Error("Share link unavailable");
  return link;
}

/** Members can rotate the one active workspace link. */
export const create = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.string(),
  handler: async (ctx, { workspaceId }) => {
    const { userId, workspace } = await requireWorkspace(ctx, workspaceId);
    if (workspace.demo === "landing")
      throw new Error("Share links are unavailable in the landing demo");
    const active = await ctx.db
      .query("workspaceShareLinks")
      .withIndex("by_workspace_revoked", (q) =>
        q.eq("workspaceId", workspaceId).eq("revoked", false),
      )
      .take(32);
    for (const link of active) await ctx.db.patch(link._id, { revoked: true });
    const token = crypto.randomUUID() + crypto.randomUUID();
    const newLinkId = await ctx.db.insert("workspaceShareLinks", {
      workspaceId,
      createdBy: userId,
      tokenHash: await hashSecret(token),
      token,
      revoked: false,
    });
    const caller = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId),
      )
      .unique();
    if (caller?.shareLinkId)
      await ctx.db.patch(caller._id, { shareLinkId: newLinkId });
    return token;
  },
});

/** The share control always has one copyable URL; repeated opens keep its token. */
export const ensure = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.string(),
  handler: async (ctx, { workspaceId }) => {
    const { userId, workspace } = await requireWorkspace(ctx, workspaceId);
    if (workspace.demo === "landing")
      throw new Error("Share links are unavailable in the landing demo");
    const active = await ctx.db
      .query("workspaceShareLinks")
      .withIndex("by_workspace_revoked", (q) =>
        q.eq("workspaceId", workspaceId).eq("revoked", false),
      )
      .take(32);
    if (active.length === 1 && active[0].token) return active[0].token;
    // Legacy links stored only a hash and cannot be displayed again.
    for (const link of active) await ctx.db.patch(link._id, { revoked: true });
    const token = crypto.randomUUID() + crypto.randomUUID();
    const linkId = await ctx.db.insert("workspaceShareLinks", {
      workspaceId,
      createdBy: userId,
      tokenHash: await hashSecret(token),
      token,
      revoked: false,
    });
    const caller = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId),
      )
      .unique();
    if (caller?.shareLinkId)
      await ctx.db.patch(caller._id, { shareLinkId: linkId });
    return token;
  },
});

export const status = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ active: v.boolean() }),
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspace(ctx, workspaceId);
    const active = await ctx.db
      .query("workspaceShareLinks")
      .withIndex("by_workspace_revoked", (q) =>
        q.eq("workspaceId", workspaceId).eq("revoked", false),
      )
      .first();
    return { active: !!active };
  },
});

export const revoke = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspace(ctx, workspaceId);
    const active = await ctx.db
      .query("workspaceShareLinks")
      .withIndex("by_workspace_revoked", (q) =>
        q.eq("workspaceId", workspaceId).eq("revoked", false),
      )
      .take(32);
    for (const link of active) await ctx.db.patch(link._id, { revoked: true });
    return null;
  },
});

/** Redeem into the ordinary member path, without granting administrator rights. */
export const redeem = mutation({
  args: { token: v.string() },
  returns: v.id("workspaces"),
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await ctx.db.get(userId)))
      throw new Error("Guest session required");
    const link = await requireShare(ctx, token);
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", link.workspaceId).eq("userId", userId),
      )
      .unique();
    if (!member)
      await ctx.db.insert("workspaceMembers", {
        workspaceId: link.workspaceId,
        userId,
        shareLinkId: link._id,
      });
    else if (member.shareLinkId && member.shareLinkId !== link._id)
      await ctx.db.patch(member._id, { shareLinkId: link._id });
    return link.workspaceId;
  },
});
