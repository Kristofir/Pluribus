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
import {
  authorizeContext,
  owned,
  membership,
  isMember,
  requireBrowserOwner,
} from "./Access";
import type { context, activity, browserCredential } from "./Model";
import { getAuthUserId } from "@convex-dev/auth/server";
type Context = Infer<typeof context>;
type Credentials = {
  context: Context;
  id: Id<"presenceParticipations">;
  capability: string;
};
type BrowserCredential = Infer<typeof browserCredential>;
const maxBrowserContexts = 32;
/** A newer focused-tab claim atomically retires all prior context activity. */
export async function claimBrowser(
  ctx: MutationCtx,
  args: {
    secret: string;
    epoch: number;
    tabId: string;
    account: Id<"users"> | null;
  },
) {
  if (
    !/^[0-9a-f]{64}$/.test(args.secret) ||
    !/^[0-9a-f-]{36}$/.test(args.tabId) ||
    !Number.isSafeInteger(args.epoch) ||
    args.epoch < 1
  )
    throw new Error("Invalid browser presence claim");
  const userId = await getAuthUserId(ctx);
  if (userId !== args.account) throw new Error("Presence account changed");
  const secretHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(args.secret),
      ),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const existing = await ctx.db
    .query("presenceBrowsers")
    .withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash))
    .unique();
  if (existing && args.epoch <= existing.epoch) {
    if (
      args.epoch === existing.epoch &&
      args.tabId === existing.tabId &&
      userId === existing.userId &&
      existing.active
    )
      return {
        id: existing._id,
        epoch: existing.epoch,
        capability: existing.capability,
      };
    return null;
  }
  const value = {
    secretHash,
    epoch: args.epoch,
    tabId: args.tabId,
    userId,
    capability: crypto.randomUUID(),
    active: true,
  };
  const id = existing?._id ?? (await ctx.db.insert("presenceBrowsers", value));
  if (existing) {
    await ctx.db.replace("presenceBrowsers", id, value);
    await eraseBrowserContexts(ctx, id);
  }
  return { id, epoch: value.epoch, capability: value.capability };
}
/** Late release is harmless after a successor has claimed ownership. */
export async function releaseBrowser(
  ctx: MutationCtx,
  { browser }: { browser: BrowserCredential },
) {
  const current = await ctx.db.get("presenceBrowsers", browser.id);
  if (
    !current ||
    current.epoch !== browser.epoch ||
    current.capability !== browser.capability
  )
    return null;
  await requireBrowserOwner(ctx, browser);
  await ctx.db.patch("presenceBrowsers", browser.id, { active: false });
  await eraseBrowserContexts(ctx, browser.id);
  return null;
}
async function eraseBrowserContexts(
  ctx: MutationCtx,
  browserId: Id<"presenceBrowsers">,
) {
  for (const row of await ctx.db
    .query("presenceParticipations")
    .withIndex("by_browser", (q) => q.eq("browserId", browserId))
    .take(maxBrowserContexts))
    await erase(ctx, row._id, row.contextKey, row.componentToken);
}
export async function join(
  ctx: MutationCtx,
  args: {
    context: Context;
    guestId: string;
    tabId: string;
    browser: BrowserCredential;
  },
) {
  const generation = await authorizeContext(ctx, args.context);
  if (generation < 0) throw new Error("Document removed");
  const owner = await requireBrowserOwner(ctx, args.browser);
  if (owner.tabId !== args.tabId)
    throw new Error("Browser presence ownership changed");
  for (const id of [args.guestId, args.tabId])
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new Error("Invalid guest/session identifier");
  const room = contextKey(args.context);
  const contexts = await ctx.db
    .query("presenceParticipations")
    .withIndex("by_browser", (q) => q.eq("browserId", owner._id))
    .take(maxBrowserContexts);
  // A lost join response reuses the live participation, never a second writer.
  const prior = contexts.find((row) => row.contextKey === room);
  if (prior) {
    if (
      prior.browserEpoch === owner.epoch &&
      prior.generation === generation &&
      (await isMember(ctx, prior._id, room))
    )
      return { id: prior._id, capability: prior.capability };
    await erase(ctx, prior._id, room, prior.componentToken);
  }
  if (contexts.length - (prior ? 1 : 0) >= maxBrowserContexts)
    throw new Error("Browser presence context capacity reached");
  if (
    (await membership.listRoom(ctx, room, true, presenceParameters.maxSessions))
      .length >= presenceParameters.maxSessions
  )
    throw new Error("Presence session capacity reached");
  const capability = crypto.randomUUID();
  const id = await ctx.db.insert("presenceParticipations", {
    context: args.context,
    guestId: args.guestId,
    tabId: args.tabId,
    browserId: owner._id,
    browserEpoch: owner.epoch,
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
  const projected = await Promise.all(
    rows.map(async (row) => {
      if (!row || (row.generation ?? 0) !== generation) return null;
      const browser = row.browserId
        ? await ctx.db.get("presenceBrowsers", row.browserId)
        : null;
      const user = browser?.userId
        ? await ctx.db.get("users", browser.userId)
        : null;
      const profile =
        user && user.isAnonymous !== true
          ? {
              kind: "user" as const,
              label: user.name?.trim() || "Pluribus member",
              ...(user.image ? { avatarUrl: user.image } : {}),
            }
          : { kind: "anonymous" as const };
      return {
        id: row._id,
        guestId: row.guestId,
        tabId: row.tabId,
        hidden: row.hidden,
        focused: row.focused,
        profile,
      };
    }),
  );
  return projected.filter((row) => row !== null);
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
    activity:
      activity.kind === "selection"
        ? {
            ...activity,
            elements: activity.elements.filter(
              (id) => !ctx.db.normalizeId("rectangles", id),
            ),
          }
        : activity,
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
  await publishActivity(args.context, args.activity, args.sequence, {
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
  // A live channel acknowledges duplicates/superseded messages without writing.
  // Lost responses can then retry safely; false means participation cannot publish.
  return true;
}
