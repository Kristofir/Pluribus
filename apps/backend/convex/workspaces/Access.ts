import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assertWorkspaceMembership,
  assertAdministrator,
} from "@pluribus/core/workspaces/access";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Resolve both membership and the resource from storage on every request. */
export async function requireWorkspace(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
) {
  return requireWorkspaceMember(ctx, workspaceId, await getAuthUserId(ctx));
}
/** Only adapters resolving a trusted grant may supply its stored user identity. */
export async function requireWorkspaceMember(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users"> | null,
) {
  const member = userId
    ? await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", workspaceId).eq("userId", userId),
        )
        .unique()
    : null;
  assertWorkspaceMembership(userId, member, workspaceId);
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Workspace unavailable");
  return { workspace, userId: userId! };
}
export async function requireAdmin(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const admin = userId
    ? await ctx.db
        .query("administrators")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique()
    : null;
  assertAdministrator(userId, admin);
}
/** Absence deliberately selects the old public demo; no private record falls back to it. */
export async function canvasScope(
  ctx: QueryCtx,
  workspaceId?: Id<"workspaces">,
) {
  if (workspaceId) await requireWorkspace(ctx, workspaceId);
  return workspaceId ?? "shared";
}
export async function requireCanvas(ctx: QueryCtx, canvasId: string) {
  if (canvasId === "shared") return;
  const workspaceId = ctx.db.normalizeId("workspaces", canvasId);
  if (!workspaceId) throw new Error("Canvas unavailable");
  await requireWorkspace(ctx, workspaceId);
}
