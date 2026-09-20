import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "./Access";

/** Bind only trusted preassignments to an actual verified account. Safe to repeat after login. */
export async function claimAssignments(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  if (!userId || !user?.email || !user.emailVerificationTime) return null;
  const assignments = await ctx.db.query("workspaceAssignments").withIndex("by_email", q => q.eq("email", user.email!.trim().toLowerCase())).take(32);
  for (const assignment of assignments) {
    const existing = await ctx.db.query("workspaceMembers").withIndex("by_workspace_user", q => q.eq("workspaceId", assignment.workspaceId).eq("userId", userId)).unique();
    if (!existing) await ctx.db.insert("workspaceMembers", { workspaceId: assignment.workspaceId, userId });
    if (assignment.admin && !(await ctx.db.query("administrators").withIndex("by_user", q => q.eq("userId", userId)).unique())) await ctx.db.insert("administrators", { userId });
  }
  return null;
}
export async function listWorkspaces(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return [];
  const memberships = await ctx.db.query("workspaceMembers").withIndex("by_user", q => q.eq("userId", userId)).take(32);
  const rows = await Promise.all(memberships.map(m => ctx.db.get(m.workspaceId)));
  return rows.flatMap(w => w ? [{ id: w._id, name: w.name, canvasId: String(w._id) }] : []);
}
export async function openWorkspace(ctx: QueryCtx, args: { workspaceId: Id<"workspaces"> }) {
  const { workspace } = await requireWorkspace(ctx, args.workspaceId);
  const document = workspace.mainDocumentId ? await ctx.db.get(workspace.mainDocumentId) : null;
  const child = document?.element ? await ctx.db.get(document.element) : null;
  if (!document || !child || child.role !== "main" || child.canvas !== workspace._id || child.documentId !== document._id || child.removed) throw new Error("Main document unavailable");
  return { workspaceId: workspace._id, name: workspace.name, canvasId: String(workspace._id), mainDocumentId: document._id, mainGeneration: child.generation };
}
