import { getAuthUserId } from "@convex-dev/auth/server";
import { assertCanvasAccess } from "@pluribus/core/canvas/access";
import {
  assertDocumentAccess,
  assertChildDocumentAccess,
} from "@pluribus/core/documents/domain";
import type { DocumentId } from "@pluribus/core/documents/domain";
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
    if (context.id !== "shared") throw new Error("Canvas not found");
    assertCanvasAccess(actor);
    return 0;
  } else {
    const id = ctx.db.normalizeId("documents", context.id);
    const doc = id && (await ctx.db.get("documents", id));
    if (!doc) throw new Error("Document not found");
    if (doc.element) {
      const child = await ctx.db.get(doc.element);
      assertChildDocumentAccess(
        actor,
        child
          ? { ...child, documentMatches: child.documentId === doc._id }
          : null,
      );
      if (!child) throw new Error("Document not found");
      return child.removed ? -1 : child.generation;
    }
    assertDocumentAccess(actor, {
      id: doc._id as string as DocumentId,
      access: doc.access,
    });
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
