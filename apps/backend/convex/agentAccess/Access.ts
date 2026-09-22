import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { hashSecret } from "../documents/Authors";
import { requireWorkspaceMember } from "../workspaces/Access";
/** Bearer capability resolves a stored, revocable delegation; it never accepts caller identity. */
export async function requireGrant(
  ctx: QueryCtx,
  token: string,
  documentId?: Id<"documents">,
) {
  if (token.length < 64 || token.length > 200)
    throw new Error("Agent access denied");
  const hash = await hashSecret(token);
  const grant = await ctx.db
    .query("agentGrants")
    .withIndex("by_token", (q) => q.eq("tokenHash", hash))
    .unique();
  if (
    !grant ||
    grant.revoked ||
    (documentId && !grant.documentIds.includes(documentId))
  )
    throw new Error("Agent access denied");
  await requireWorkspaceMember(ctx, grant.workspaceId, grant.userId);
  return grant;
}
