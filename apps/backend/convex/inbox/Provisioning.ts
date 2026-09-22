import { v } from "convex/values";
import { internalMutation, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { createInbox } from "./AgentMail";
const workspace = { workspaceId: v.id("workspaces") };
const attempt = {
  id: v.id("workspaceInboxProvisioning"),
  revision: v.number(),
};
/** One durable creation identity per workspace; retries never choose another provider resource. */
export const ensure = internalMutation({
  args: workspace,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.workspaceId)))
      throw new Error("Workspace unavailable");
    const bound = await ctx.db
      .query("workspaceInboxes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (bound) return null;
    const current = await ctx.db
      .query("workspaceInboxProvisioning")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (current && current.status !== "failed") return null;
    const revision = (current?.revision ?? 0) + 1;
    const id =
      current?._id ??
      (await ctx.db.insert("workspaceInboxProvisioning", {
        workspaceId: args.workspaceId,
        clientId: crypto.randomUUID(),
        revision,
        status: "pending",
      }));
    if (current)
      await ctx.db.patch(id, { revision, status: "pending", error: undefined });
    await ctx.scheduler.runAfter(0, internal.inbox.Provisioning.create, {
      id,
      revision,
    });
    await ctx.scheduler.runAfter(60000, internal.inbox.Provisioning.expire, {
      id,
      revision,
    });
    return null;
  },
});
export const begin = internalMutation({
  args: attempt,
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.revision !== args.revision || row.status !== "pending")
      return null;
    if (!(await ctx.db.get(row.workspaceId)))
      throw new Error("Workspace unavailable");
    await ctx.db.patch(row._id, { status: "provisioning" });
    return row.clientId;
  },
});
export const complete = internalMutation({
  args: {
    ...attempt,
    providerInboxId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.revision !== args.revision || row.status !== "provisioning")
      return null;
    if (!args.providerInboxId) {
      await ctx.db.patch(row._id, {
        status: "failed",
        error:
          args.error ?? "Inbox setup failed. Retry to recover the same inbox.",
      });
      return null;
    }
    if (!(await ctx.db.get(row.workspaceId)))
      throw new Error("Workspace unavailable");
    const other = await ctx.db
      .query("workspaceInboxes")
      .withIndex("by_provider", (q) =>
        q.eq("providerInboxId", args.providerInboxId!),
      )
      .unique();
    const bound = await ctx.db
      .query("workspaceInboxes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", row.workspaceId))
      .unique();
    if (
      (other && other.workspaceId !== row.workspaceId) ||
      (bound && bound.providerInboxId !== args.providerInboxId)
    )
      throw new Error("Inbox ownership conflict");
    if (!bound)
      await ctx.db.insert("workspaceInboxes", {
        workspaceId: row.workspaceId,
        providerInboxId: args.providerInboxId,
        revision: 0,
        status: "idle",
      });
    await ctx.db.patch(row._id, { status: "ready", error: undefined });
    return null;
  },
});
export const expire = internalMutation({
  args: attempt,
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      row &&
      row.revision === args.revision &&
      ["pending", "provisioning"].includes(row.status)
    )
      await ctx.db.patch(row._id, {
        status: "failed",
        error: "Inbox setup timed out. Retry safely to recover the same inbox.",
      });
    return null;
  },
});
export const create = internalAction({
  args: attempt,
  returns: v.null(),
  handler: async (ctx, args) => {
    const clientId = await ctx.runMutation(
      internal.inbox.Provisioning.begin,
      args,
    );
    if (!clientId) return null;
    try {
      const providerInboxId = await createInbox(clientId);
      await ctx.runMutation(internal.inbox.Provisioning.complete, {
        ...args,
        providerInboxId,
      });
    } catch {
      await ctx.runMutation(internal.inbox.Provisioning.complete, {
        ...args,
        error:
          "Inbox setup unavailable. Check AgentMail configuration, then retry safely.",
      });
    }
    return null;
  },
});
