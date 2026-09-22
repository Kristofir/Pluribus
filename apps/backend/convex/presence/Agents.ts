import type { Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { context as presenceContext } from "./Model";
import { authorizeContext } from "./Access";
import { requireWorkspaceMember } from "../workspaces/Access";
/** Project authenticated MCP activity into a content room without browser membership. */
export async function agentRoster(
  ctx: QueryCtx,
  { context }: { context: Infer<typeof presenceContext> },
) {
  if ((await authorizeContext(ctx, context)) < 0) return [];
  const workspaceId =
    context.kind === "canvas"
      ? ctx.db.normalizeId("workspaces", context.id)
      : (await ctx.db.get("documents", context.id))?.workspaceId;
  if (!workspaceId) return [];
  const now = Date.now();
  const grants = await ctx.db
    .query("agentGrants")
    .withIndex("by_workspace_revoked", (q) =>
      q.eq("workspaceId", workspaceId).eq("revoked", false),
    )
    .take(32);
  const recent = grants.filter(
    (grant) => grant.presenceDeadlineAt && grant.presenceDeadlineAt > now,
  );
  const eligible = await Promise.all(
    recent.map(async (grant) => {
      try {
        await requireWorkspaceMember(ctx, workspaceId, grant.userId);
        return { id: grant._id, label: grant.label };
      } catch {
        return null;
      }
    }),
  );
  return eligible.filter(
    (agent): agent is NonNullable<typeof agent> => agent !== null,
  );
}
