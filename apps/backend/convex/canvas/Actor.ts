import { getAuthUserId } from "@convex-dev/auth/server";
import type { CanvasActor } from "@pluribus/core/canvas/access";
import type { QueryCtx } from "../_generated/server";

export async function canvasActor(
  ctx: Pick<QueryCtx, "auth">,
): Promise<CanvasActor> {
  return (await getAuthUserId(ctx)) === null
    ? { kind: "anonymous" }
    : { kind: "authenticated" };
}
