import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get("users", userId);
    if (user === null) return null;

    return { name: user.name, email: user.email };
  },
});
