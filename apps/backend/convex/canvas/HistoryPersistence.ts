import { createRectangle } from "@pluribus/core/canvas/application";
import { createCanvasDocument } from "@pluribus/core/canvas/documents";
import type { HistoryPorts } from "@pluribus/core/canvas/history/ports";
import type {
  HistoryActionRecord,
  HistoryOutcome,
} from "@pluribus/core/canvas/history";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { rectanglePersistence } from "./Persistence";
import { canvasDocuments } from "./Documents";
import { childText } from "../documents/ChildText";
import { toElementId } from "./ElementLifecycles";
import type { CanvasActor } from "@pluribus/core/canvas/access";
import {
  historyLimits,
  HistoryProtocolError,
} from "@pluribus/core/canvas/history";

export function storedElement(ctx: QueryCtx, id: string) {
  const value =
    ctx.db.normalizeId("rectangles", id) ??
    ctx.db.normalizeId("canvasDocuments", id);
  if (!value) throw new Error("Invalid Element identity");
  return value;
}
export function storedOutcome(ctx: QueryCtx, result: HistoryOutcome) {
  return { ...result, id: result.id ? storedElement(ctx, result.id) : null };
}
export function findHistoryAction(
  ctx: QueryCtx,
  session: Id<"canvasHistorySessions">,
  action: string,
) {
  return ctx.db
    .query("canvasHistoryActions")
    .withIndex("by_session_action", (q) =>
      q.eq("session", session).eq("action", action),
    )
    .unique();
}
export function coreRecord(
  row: NonNullable<Awaited<ReturnType<typeof findHistoryAction>>>,
): HistoryActionRecord {
  const payload =
    row.payload.kind === "geometry"
      ? {
          ...row.payload,
          changes: row.payload.changes.map((c) => ({
            ...c,
            id: toElementId(c.id),
          })),
        }
      : { ...row.payload, id: toElementId(row.payload.id) };
  return {
    action: row.action,
    version: row.version,
    revision: row.revision,
    state: row.state,
    payload,
  };
}
export function checkHistorySize(value: unknown) {
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    historyLimits.bytes
  )
    throw new HistoryProtocolError("History payload exceeds 128 KiB");
}
/** Narrow session-bound adapters; one action never scans another session's history. */
export function historyPorts(
  ctx: MutationCtx,
  session: Id<"canvasHistorySessions">,
  actor: CanvasActor,
): HistoryPorts {
  const rectangles = rectanglePersistence(ctx),
    documents = canvasDocuments(ctx);
  const target = (element: ReturnType<typeof storedElement>) =>
    ctx.db
      .query("canvasHistoryTargets")
      .withIndex("by_session_element", (q) =>
        q.eq("session", session).eq("element", element),
      )
      .unique();
  return {
    now: Date.now(),
    elements: {
      async get(id) {
        const stored = storedElement(ctx, id),
          row = await ctx.db.get(stored);
        if (!row) return null;
        return {
          id,
          kind: ctx.db.normalizeId("rectangles", id) ? "rectangle" : "document",
          generation: row.generation ?? 1,
          removed: row.removed ?? false,
          activeDeletion: row.activeDeletion ?? null,
          geometry: {
            x: row.x,
            y: row.y,
            width: row.width,
            height: row.height,
          },
        };
      },
      create: (input) =>
        input.kind === "rectangle"
          ? createRectangle({ rectangles }, actor, input)
          : createCanvasDocument(
              { cards: documents, text: childText(ctx) },
              actor,
              input.geometry,
            ),
      count: (kind) =>
        kind === "rectangle" ? rectangles.countUpTo(200) : documents.count(),
      geometry: (id, geometry) =>
        ctx.db.patch(storedElement(ctx, id), geometry),
      async lifecycle(id, removed, generation, deletion) {
        const stored = storedElement(ctx, id);
        await ctx.db.patch(stored, {
          removed: ctx.db.normalizeId("rectangles", id)
            ? removed
              ? true
              : undefined
            : removed,
          generation,
          activeDeletion: deletion ?? undefined,
        });
      },
    },
    actions: {
      async get(action) {
        const row = await findHistoryAction(ctx, session, action);
        return row ? coreRecord(row) : null;
      },
      async save(record) {
        checkHistorySize(record);
        const row = await findHistoryAction(ctx, session, record.action);
        const payload =
          record.payload.kind === "geometry"
            ? {
                ...record.payload,
                changes: record.payload.changes.map((c) => ({
                  ...c,
                  id: storedElement(ctx, c.id),
                })),
              }
            : { ...record.payload, id: storedElement(ctx, record.payload.id) };
        const value = { ...record, session, payload };
        if (row) await ctx.db.replace(row._id, value);
        else await ctx.db.insert("canvasHistoryActions", value);
      },
    },
    targets: {
      async get(id) {
        const row = await target(storedElement(ctx, id));
        return row
          ? {
              lineage: row.lineage,
              generation: row.generation,
              removed: row.removed,
            }
          : null;
      },
      async save(id, value) {
        const element = storedElement(ctx, id),
          row = await target(element);
        if (row) await ctx.db.patch(row._id, value);
        else
          await ctx.db.insert("canvasHistoryTargets", {
            session,
            element,
            ...value,
          });
      },
    },
    attempts: {
      async get(attempt) {
        const row = await ctx.db
          .query("canvasHistoryAttempts")
          .withIndex("by_session_attempt", (q) =>
            q.eq("session", session).eq("attempt", attempt),
          )
          .unique();
        return row
          ? {
              fingerprint: row.fingerprint,
              outcome: {
                ...row.outcome,
                id: row.outcome.id ? toElementId(row.outcome.id) : null,
              },
            }
          : null;
      },
      async save(attempt, fingerprint, result) {
        await ctx.db.insert("canvasHistoryAttempts", {
          session,
          attempt,
          fingerprint,
          outcome: storedOutcome(ctx, result),
        });
      },
    },
    async schedule(action, deadline) {
      await ctx.scheduler.runAt(
        deadline,
        internal.canvas.History.expireGesture,
        { session, action },
      );
    },
  };
}
