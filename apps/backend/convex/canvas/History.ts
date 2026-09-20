import { InvalidElementGeometry } from "@pluribus/core/canvas/domain";
import { ConvexError, v, type Infer } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertCanvasAccess } from "@pluribus/core/canvas/access";
import {
  executeHistoryAttempt,
  type DurableHistoryCommand,
} from "@pluribus/core/canvas/history/operations";
import {
  updateGesture,
  sealGesture,
} from "@pluribus/core/canvas/history/geometry";
import {
  historyLimits,
  HistoryProtocolError,
} from "@pluribus/core/canvas/history";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { actionInput, geometryUpdates } from "./HistoryModel";
import {
  checkHistorySize,
  coreRecord,
  findHistoryAction,
  historyPorts,
  storedOutcome,
} from "./HistoryPersistence";
import { toElementId } from "./ElementLifecycles";
import { sameGeometry } from "@pluribus/core/canvas/geometryHistory";

type Auth = { session: Id<"canvasHistorySessions">; secret: string };
function uuid(value: string) {
  if (!/^[0-9a-f-]{36}$/.test(value))
    throw new ConvexError({
      code: "HISTORY_REJECTED",
      message: "Invalid History identity.",
    });
}
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
/** Stable sorted serialization binds requests independently of argument property order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
async function authenticate(ctx: QueryCtx, args: Auth) {
  uuid(args.secret);
  const row = await ctx.db.get(args.session),
    owner = await getAuthUserId(ctx);
  if (
    !row ||
    row.scope !== "shared" ||
    row.owner !== owner ||
    row.proof !== (await hash(args.secret))
  )
    throw new ConvexError({
      code: "HISTORY_REJECTED",
      message: "History belongs to another editing session.",
    });
  const actor = owner
    ? { kind: "authenticated" as const }
    : { kind: "anonymous" as const };
  assertCanvasAccess(actor);
  return actor;
}
/** Wrap deterministic failures as terminal errors while preserving transaction rollback. */
async function validated<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    // Explicit protocol and domain errors are terminal; infrastructure errors remain uncertain.
    if (
      error instanceof HistoryProtocolError ||
      error instanceof InvalidElementGeometry
    )
      throw new ConvexError({
        code: "HISTORY_REJECTED",
        message: error.message,
      });
    throw error;
  }
}
export async function openSession(
  ctx: MutationCtx,
  args: { nonce: string; secret: string },
) {
  uuid(args.nonce);
  uuid(args.secret);
  const owner = await getAuthUserId(ctx),
    proof = await hash(args.secret);
  const row = await ctx.db
    .query("canvasHistorySessions")
    .withIndex("by_nonce", (q) => q.eq("nonce", args.nonce))
    .unique();
  if (row) {
    if (row.owner !== owner || row.proof !== proof)
      throw new ConvexError({
        code: "HISTORY_REJECTED",
        message: "History session identity was reused.",
      });
    return row._id;
  }
  return ctx.db.insert("canvasHistorySessions", {
    nonce: args.nonce,
    owner,
    proof,
    scope: "shared",
    version: 2,
  });
}
async function execute(
  ctx: MutationCtx,
  args: Auth & { action: string; attempt: string },
  command: DurableHistoryCommand,
) {
  return validated(async () => {
    const actor = await authenticate(ctx, args);
    uuid(args.action);
    uuid(args.attempt);
    checkHistorySize(command);
    const result = await executeHistoryAttempt(
      historyPorts(ctx, args.session, actor),
      {
        action: args.action,
        attempt: args.attempt,
        fingerprint: await hash(canonical({ action: args.action, command })),
        deletion: `v2:${args.session}:${args.attempt}`,
        command,
      },
    );
    return storedOutcome(ctx, result);
  });
}
export function applyAction(
  ctx: MutationCtx,
  args: Auth & { action: string; attempt: string } & {
    input: Infer<typeof actionInput>;
  },
) {
  return execute(ctx, args, {
    kind: "apply",
    input:
      args.input.kind === "delete"
        ? { ...args.input, id: toElementId(args.input.id) }
        : args.input,
  });
}
export function reverseAction(
  ctx: MutationCtx,
  args: Auth & {
    action: string;
    attempt: string;
    undo: boolean;
    revision: number;
  },
) {
  return execute(ctx, args, {
    kind: "reverse",
    undo: args.undo,
    revision: args.revision,
  });
}
export function closeGesture(
  ctx: MutationCtx,
  args: Auth & { action: string; attempt: string; sequence: number },
) {
  return execute(ctx, args, { kind: "close", sequence: args.sequence });
}
export function updateGeometry(
  ctx: MutationCtx,
  args: Auth & {
    action: string;
    sequence: number;
    updates: Infer<typeof geometryUpdates>;
  },
) {
  return validated(async () => {
    const actor = await authenticate(ctx, args);
    uuid(args.action);
    checkHistorySize(args.updates);
    return updateGesture(
      historyPorts(ctx, args.session, actor),
      args.action,
      args.sequence,
      await hash(canonical({ sequence: args.sequence, updates: args.updates })),
      args.updates.map((u) => ({ ...u, id: toElementId(u.id) })),
    );
  });
}
export async function heartbeat(
  ctx: MutationCtx,
  args: Auth & { action: string },
) {
  const actor = await authenticate(ctx, args),
    ports = historyPorts(ctx, args.session, actor),
    record = await ports.actions.get(args.action);
  if (!record || record.payload.kind !== "geometry" || record.state !== "open")
    return false;
  if (record.payload.deadline <= ports.now) {
    await sealGesture(ports, record);
    return false;
  }
  await ports.actions.save({
    ...record,
    payload: { ...record.payload, deadline: ports.now + historyLimits.idleMs },
  });
  return true;
}
/** One checker per open gesture; only this checker reschedules when the lease was refreshed. */
export const expireGesture = internalMutation({
  args: { session: v.id("canvasHistorySessions"), action: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.session);
    if (!row) return null;
    const ports = historyPorts(
      ctx,
      args.session,
      row.owner ? { kind: "authenticated" } : { kind: "anonymous" },
    );
    const record = await ports.actions.get(args.action);
    if (
      !record ||
      record.state !== "open" ||
      record.payload.kind !== "geometry"
    )
      return null;
    if (record.payload.deadline > ports.now)
      await ports.schedule(args.action, record.payload.deadline);
    else await sealGesture(ports, record);
    return null;
  },
});
export async function readAction(
  ctx: QueryCtx,
  args: Auth & { action: string },
) {
  await authenticate(ctx, args);
  const row = await findHistoryAction(ctx, args.session, args.action);
  if (!row) return null;
  const record = coreRecord(row),
    p = row.payload;
  let reversible = record.state === "applied" || record.state === "undone";
  const targets = p.kind === "geometry" ? p.changes : [p];
  for (const target of targets) {
    const element = await ctx.db.get(target.id);
    const binding = await ctx.db
      .query("canvasHistoryTargets")
      .withIndex("by_session_element", (q) =>
        q.eq("session", args.session).eq("element", target.id),
      )
      .unique();
    if (
      !element ||
      !binding ||
      binding.lineage !== target.lineage ||
      binding.generation !== (element.generation ?? 1) ||
      binding.removed !== (element.removed ?? false)
    ) {
      reversible = false;
      continue;
    }
    if (p.kind === "geometry") {
      const change = p.changes.find((c) => c.id === target.id)!;
      if (
        element.removed ||
        !sameGeometry(
          element,
          record.state === "applied" ? change.after : change.before,
        )
      )
        reversible = false;
    } else {
      const removing =
        p.kind === "create"
          ? record.state === "applied"
          : record.state === "undone";
      if (
        removing
          ? element.removed
          : !element.removed ||
            element.activeDeletion !== p.deletion ||
            element.generation !== p.deletedGeneration
      )
        reversible = false;
    }
  }
  return {
    action: record.action,
    state: record.state,
    revision: record.revision,
    sequence: p.kind === "geometry" ? p.sequence : 0,
    reversible,
  };
}
