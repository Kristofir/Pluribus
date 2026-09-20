import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "./_generated/server";
import { listWorkspaces, openWorkspace, claimAssignments } from "./workspaces/Handlers";
import { requireAdmin } from "./workspaces/Access";
export const list = query({ args: {}, returns: v.array(v.object({ id: v.id("workspaces"), name: v.string(), canvasId: v.string() })), handler: listWorkspaces });
export const claim = mutation({ args: {}, returns: v.null(), handler: claimAssignments });
export const open = query({ args: { workspaceId: v.id("workspaces") }, returns: v.object({ workspaceId: v.id("workspaces"), name: v.string(), canvasId: v.string(), mainDocumentId: v.id("documents"), mainGeneration: v.number() }), handler: openWorkspace });
const adminRow = v.object({ id: v.string(), label: v.string(), workspaceId: v.union(v.string(), v.null()), userId: v.union(v.string(), v.null()) });
/** Independently authorized read-only pages; no account or role administration. */
export const admin = query({
 args: { table: v.union(v.literal("users"), v.literal("workspaces"), v.literal("memberships")), paginationOpts: paginationOptsValidator },
 returns: v.object({ page: v.array(adminRow), isDone: v.boolean(), continueCursor: v.string() }),
 handler: async (ctx, args) => {
  await requireAdmin(ctx);
  const opts = { ...args.paginationOpts, numItems: Math.min(50, args.paginationOpts.numItems) };
  if (args.table === "users") { const result = await ctx.db.query("users").paginate(opts); return { isDone: result.isDone, continueCursor: result.continueCursor, page: result.page.map(r => ({ id: String(r._id), label: r.name ?? r.email ?? "Unnamed user", workspaceId: null, userId: String(r._id) })) }; }
  if (args.table === "workspaces") { const result = await ctx.db.query("workspaces").paginate(opts); return { isDone: result.isDone, continueCursor: result.continueCursor, page: result.page.map(r => ({ id: String(r._id), label: r.name, workspaceId: String(r._id), userId: null })) }; }
  const result = await ctx.db.query("workspaceMembers").paginate(opts); return { isDone: result.isDone, continueCursor: result.continueCursor, page: result.page.map(r => ({ id: String(r._id), label: "Member", workspaceId: String(r.workspaceId), userId: String(r.userId) })) };
 }
});
