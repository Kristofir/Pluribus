import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireWorkspace } from "./workspaces/Access";
import { runOpenAiBoardAgent } from "./chat/OpenAiBoardAgent";

export const messages = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({
      id: v.id("assistantMessages"),
      createdAt: v.number(),
      role: v.union(v.literal("user"), v.literal("assistant")),
      mine: v.boolean(),
      text: v.string(),
      status: v.union(v.literal("complete"), v.literal("failed")),
      tools: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const { userId } = await requireWorkspace(ctx, args.workspaceId);
    const thread = await ctx.db
      .query("assistantThreads")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (!thread) return [];
    const rows = await ctx.db
      .query("assistantMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .take(80);
    return rows
      .reverse()
      .filter((row) => row._creationTime > (thread.clearedAt ?? 0))
      .map((row) => ({
        id: row._id,
        createdAt: row._creationTime,
        role: row.role,
        mine: row.userId === userId,
        text: row.text,
        status: row.status,
        tools: row.tools,
      }));
  },
});

export const clear = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const thread = await ctx.db
      .query("assistantThreads")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (!thread) return null;
    const now = Date.now();
    await ctx.db.patch(thread._id, {
      clearedAt: now,
      updatedAt: now,
      generation: (thread.generation ?? 1) + 1,
    });
    const grants = await ctx.db
      .query("agentGrants")
      .withIndex("by_workspace_revoked", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("revoked", false),
      )
      .take(32);
    for (const grant of grants)
      if (grant.purpose === "chat")
        await ctx.db.patch(grant._id, {
          revoked: true,
          presenceDeadlineAt: undefined,
        });
    return null;
  },
});

export const send = action({
  args: { workspaceId: v.id("workspaces"), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const turn = await ctx.runMutation(internal.chat.Store.begin, args);
    try {
      const result = await runOpenAiBoardAgent(ctx, turn.token, turn.messages);
      await ctx.runMutation(internal.chat.Store.finish, {
        threadId: turn.threadId,
        generation: turn.generation,
        grantId: turn.grantId,
        text: result.text,
        failed: false,
        tools: result.tools,
      });
    } catch {
      await ctx.runMutation(internal.chat.Store.finish, {
        threadId: turn.threadId,
        generation: turn.generation,
        grantId: turn.grantId,
        text: "I couldn't complete that request. Please try again or make the instruction more specific.",
        failed: true,
        tools: [],
      });
    }
    return null;
  },
});
