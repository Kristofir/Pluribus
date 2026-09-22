import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { requireWorkspace } from "../workspaces/Access";
import { hashSecret } from "../documents/Authors";

const storedMessage = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  text: v.string(),
});

export const begin = internalMutation({
  args: { workspaceId: v.id("workspaces"), text: v.string() },
  returns: v.object({
    threadId: v.id("assistantThreads"),
    generation: v.number(),
    grantId: v.id("agentGrants"),
    token: v.string(),
    messages: v.array(storedMessage),
  }),
  handler: async (ctx, args) => {
    const { userId, workspace } = await requireWorkspace(ctx, args.workspaceId);
    if (workspace.demo === "landing")
      throw new Error("Chat is unavailable in the landing demo");
    const text = args.text.trim();
    if (!text || text.length > 4000) throw new Error("Invalid chat message");

    let thread = await ctx.db
      .query("assistantThreads")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (!thread) {
      const authorId = await ctx.db.insert("documentAuthors", {
        kind: "agent",
        label: "Pluribus agent",
      });
      const threadId = await ctx.db.insert("assistantThreads", {
        workspaceId: args.workspaceId,
        authorId,
        updatedAt: Date.now(),
        generation: 1,
      });
      thread = await ctx.db.get(threadId);
    }
    if (!thread) throw new Error("Chat thread unavailable");

    const oldGrants = await ctx.db
      .query("agentGrants")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId),
      )
      .collect();
    for (const grant of oldGrants)
      if (!grant.revoked && grant.purpose === "chat")
        await ctx.db.patch(grant._id, {
          revoked: true,
          presenceDeadlineAt: undefined,
        });

    const prior = (
      await ctx.db
        .query("assistantMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .order("desc")
        .take(24)
    ).filter((message) => message._creationTime > (thread.clearedAt ?? 0));
    await ctx.db.insert("assistantMessages", {
      threadId: thread._id,
      workspaceId: args.workspaceId,
      userId,
      role: "user",
      text,
      status: "complete",
      tools: [],
    });
    await ctx.db.patch(thread._id, { updatedAt: Date.now() });

    const token = crypto.randomUUID() + crypto.randomUUID();
    const grantId = await ctx.db.insert("agentGrants", {
      workspaceId: args.workspaceId,
      userId,
      documentIds: [],
      workspaceScope: true,
      authorId: thread.authorId,
      tokenHash: await hashSecret(token),
      revoked: false,
      label: "Pluribus agent",
      purpose: "chat",
    });
    return {
      threadId: thread._id,
      generation: thread.generation ?? 1,
      grantId,
      token,
      messages: [
        ...prior.reverse().map(({ role, text: value }) => ({
          role,
          text: value,
        })),
        { role: "user" as const, text },
      ],
    };
  },
});

export const finish = internalMutation({
  args: {
    threadId: v.id("assistantThreads"),
    generation: v.number(),
    grantId: v.id("agentGrants"),
    text: v.string(),
    failed: v.boolean(),
    tools: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    const grant = await ctx.db.get(args.grantId);
    if (!thread || !grant || grant.workspaceId !== thread.workspaceId)
      throw new Error("Chat turn unavailable");
    const { userId } = await requireWorkspace(ctx, thread.workspaceId);
    if (grant.userId !== userId || grant.purpose !== "chat")
      throw new Error("Chat turn unavailable");
    if (grant.revoked || (thread.generation ?? 1) !== args.generation) {
      if (!grant.revoked)
        await ctx.db.patch(grant._id, {
          revoked: true,
          presenceDeadlineAt: undefined,
        });
      return null;
    }
    await ctx.db.insert("assistantMessages", {
      threadId: thread._id,
      workspaceId: thread.workspaceId,
      userId,
      role: "assistant",
      text: args.text.slice(0, 20000),
      status: args.failed ? "failed" : "complete",
      tools: args.tools.slice(0, 20),
    });
    await ctx.db.patch(thread._id, { updatedAt: Date.now() });
    await ctx.db.patch(grant._id, {
      revoked: true,
      presenceDeadlineAt: undefined,
    });
    return null;
  },
});
