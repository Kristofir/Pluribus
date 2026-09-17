import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { contextKey, presenceParameters } from "@pluribus/core/presence/domain";
import { publishActivity } from "@pluribus/core/presence/application";
import { authorizeContext, owned, membership, isMember } from "./Access";
import type { context, activity } from "./Model";
type Context = Infer<typeof context>;
type Credentials = {
  context: Context;
  id: Id<"presenceParticipations">;
  capability: string;
};
export async function join(
  ctx: MutationCtx,
  args: { context: Context; guestId: string; tabId: string },
) {
  const generation = await authorizeContext(ctx, args.context);
  if (generation < 0) throw new Error("Document removed");
  for (const id of [args.guestId, args.tabId])
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new Error("Invalid guest/session identifier");
  const room = contextKey(args.context);
  if (
    (await membership.listRoom(ctx, room, true, presenceParameters.maxSessions))
      .length >= presenceParameters.maxSessions
  )
    throw new Error("Presence session capacity reached");
  const capability = crypto.randomUUID();
  const id = await ctx.db.insert("presenceParticipations", {
    ...args,
    generation,
    contextKey: room,
    capability,
    componentToken: "",
    hidden: false,
    focused: true,
    lifecycleSequence: 0,
  });
  // A component user represents one participation, allowing authoritative per-tab expiry.
  const token = await membership.heartbeat(
    ctx,
    room,
    id,
    id,
    presenceParameters.heartbeatMs,
  );
  await ctx.db.patch("presenceParticipations", id, {
    componentToken: token.sessionToken,
  });
  await ctx.scheduler.runAfter(60_000, internal.presence.Handlers.cleanup, {
    id,
  });
  return { id, capability };
}
export async function heartbeat(ctx: MutationCtx, args: Credentials) {
  const record = await owned(ctx, args);
  // Expired incarnations cannot be revived by delayed requests; clients acquire a fresh one.
  if (!(await isMember(ctx, record._id, record.contextKey))) return false;
  await membership.heartbeat(
    ctx,
    record.contextKey,
    record._id,
    record._id,
    presenceParameters.heartbeatMs,
  );
  return true;
}
export async function lifecycle(
  ctx: MutationCtx,
  args: Credentials & { sequence: number; hidden: boolean; focused: boolean },
) {
  const record = await owned(ctx, args);
  if (!Number.isSafeInteger(args.sequence) || args.sequence < 0)
    throw new Error("Invalid lifecycle sequence");
  if (
    args.sequence <= record.lifecycleSequence ||
    !(await isMember(ctx, record._id, record.contextKey))
  )
    return false;
  await ctx.db.patch("presenceParticipations", record._id, {
    lifecycleSequence: args.sequence,
    hidden: args.hidden,
    focused: args.focused,
  });
  return true;
}
export async function leave(ctx: MutationCtx, args: Credentials) {
  const record = await ctx.db.get("presenceParticipations", args.id);
  if (!record) return null;
  await owned(ctx, args, true);
  await erase(ctx, record._id, record.contextKey, record.componentToken);
  return null;
}
async function erase(
  ctx: MutationCtx,
  id: Id<"presenceParticipations">,
  room: string,
  token: string,
) {
  await membership.disconnect(ctx, token);
  await membership.removeRoomUser(ctx, room, id);
  for (const row of await ctx.db
    .query("presenceActivity")
    .withIndex("by_participationId_and_channel", (q) =>
      q.eq("participationId", id),
    )
    .take(4))
    await ctx.db.delete("presenceActivity", row._id);
  await ctx.db.delete("presenceParticipations", id);
}
/** Garbage collection follows component membership; it never decides online status. */
export const cleanup = internalMutation({
  args: { id: v.id("presenceParticipations") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("presenceParticipations", id);
    if (!row) return null;
    if (await isMember(ctx, id, row.contextKey))
      await ctx.scheduler.runAfter(60_000, internal.presence.Handlers.cleanup, {
        id,
      });
    else await erase(ctx, id, row.contextKey, row.componentToken);
    return null;
  },
});
export async function roster(ctx: QueryCtx, args: { context: Context }) {
  const generation = await authorizeContext(ctx, args.context);
  if (generation < 0) return [];
  const members = await membership.listRoom(
    ctx,
    contextKey(args.context),
    true,
    presenceParameters.maxSessions,
  );
  const rows = await Promise.all(
    members.map((m) => {
      const id = ctx.db.normalizeId("presenceParticipations", m.userId);
      return id ? ctx.db.get("presenceParticipations", id) : null;
    }),
  );
  return rows.flatMap((row) =>
    row && (row.generation ?? 0) === generation
      ? [
          {
            id: row._id,
            guestId: row.guestId,
            tabId: row.tabId,
            hidden: row.hidden,
            focused: row.focused,
          },
        ]
      : [],
  );
}
export async function activities(ctx: QueryCtx, args: { context: Context }) {
  const members = await roster(ctx, args);
  const rows = await Promise.all(
    members.map((m) =>
      ctx.db
        .query("presenceActivity")
        .withIndex("by_participationId_and_channel", (q) =>
          q.eq("participationId", m.id),
        )
        .take(4),
    ),
  );
  return rows.flat().map(({ participationId, sequence, activity }) => ({
    participationId,
    sequence,
    activity,
  }));
}
export async function publish(
  ctx: MutationCtx,
  args: Credentials & { sequence: number; activity: Infer<typeof activity> },
) {
  const row = await owned(ctx, args);
  if (row.hidden || !(await isMember(ctx, row._id, row.contextKey)))
    return false;
  const existing = await ctx.db
    .query("presenceActivity")
    .withIndex("by_participationId_and_channel", (q) =>
      q.eq("participationId", row._id).eq("channel", args.activity.kind),
    )
    .unique();
  return publishActivity(args.context, args.activity, args.sequence, {
    currentSequence: async () => existing?.sequence ?? -1,
    save: async (activity, sequence) => {
      const value = {
        participationId: row._id,
        contextKey: row.contextKey,
        channel: activity.kind,
        sequence,
        activity,
      };
      if (existing)
        await ctx.db.replace("presenceActivity", existing._id, value);
      else await ctx.db.insert("presenceActivity", value);
    },
  });
}
