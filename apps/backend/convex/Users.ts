import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Return the signed-in account identity and display fields. The stable ID also
 * scopes transient recovery so it cannot carry over to another account.
 * Anonymous sessions and missing user records return null. This is an authorized
 * read projection, not a workspace-membership or product-access decision.
 */
export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get("users", userId);
    if (user === null) return null;

    return { id: user._id, name: user.name, email: user.email };
  },
});
