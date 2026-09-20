import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "../_generated/server";

/** Resolve identity and hash the operation capability; raw secrets never enter receipt storage. */
export async function historyCredentials(
  ctx: MutationCtx,
  operation: string,
  secret: string,
) {
  if (![operation, secret].every((value) => /^[0-9a-f-]{36}$/.test(value)))
    throw new Error("Invalid history credential");
  const owner = await getAuthUserId(ctx);
  const proof = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    actor: {
      access: owner
        ? { kind: "authenticated" as const }
        : { kind: "anonymous" as const },
      owner,
    },
    credential: { operation, proof },
  };
}
