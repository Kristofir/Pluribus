import { requireCanvas } from "../workspaces/Access";
import { requireDocument } from "../documents/Access";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertCanvasAccess } from "@pluribus/core/canvas/access";
import {
  contextKey,
  type PresenceContext,
} from "@pluribus/core/presence/domain";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { Presence } from "@convex-dev/presence";
import { components } from "../_generated/api";
export const membership = new Presence(components.presence);
export async function authorizeContext(
  ctx: QueryCtx,
  context: PresenceContext,
) {
  const actor =
    (await getAuthUserId(ctx)) === null
      ? { kind: "anonymous" as const }
      : { kind: "authenticated" as const };
  if (context.kind === "canvas") {
    await requireCanvas(ctx, context.id);
    assertCanvasAccess(actor);
    return 0;
  } else {
    const doc = await requireDocument(ctx, context.id);
    if (doc.element) {
      const child = await ctx.db.get(doc.element);
      if (!child) throw new Error("Document not found");
      return child.removed ? -1 : child.generation;
    }
    return 0;
  }
}
export async function owned(
  ctx: QueryCtx,
  args: {
    context: PresenceContext;
    id: Id<"presenceParticipations">;
    capability: string;
  },
  allowRetired = false,
) {
  const generation = await authorizeContext(ctx, args.context);
  const record = await ctx.db.get("presenceParticipations", args.id);
  if (
    (!allowRetired && generation < 0) ||
    !record ||
    (!allowRetired && (record.generation ?? 0) !== generation) ||
    record.contextKey !== contextKey(args.context) ||
    record.capability !== args.capability
  )
    throw new Error("Invalid participation capability");
  return record;
}
export async function isMember(ctx: QueryCtx, id: string, room: string) {
  return (await membership.listUser(ctx, id, true, 1)).some(
    (item) => item.roomId === room,
  );
}
