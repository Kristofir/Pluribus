import { v } from "convex/values";
import { query } from "./_generated/server";

// Read-only connectivity check; no application data or account details.
/**
 * Public, read-only liveness query used by the frontend connectivity indicator.
 * A successful result proves the backend responds, not that authentication or
 * every feature is healthy. No account or product data is read.
 */
export const check = query({
  args: {},
  returns: v.object({ status: v.literal("ok") }),
  handler: async () => ({ status: "ok" as const }),
});
