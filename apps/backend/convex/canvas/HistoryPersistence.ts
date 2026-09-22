import {
  activeSources,
  requestSource,
  requestSourceForMember,
} from "../sources/Persistence";
import { defaultSourceGeometry } from "../sources/Model";
import { createCanvasDocument } from "@pluribus/core/canvas/documents";
import type { HistoryPorts } from "@pluribus/core/canvas/history/ports";
import type {
  HistoryActionRecord,
  HistoryOutcome,
} from "@pluribus/core/canvas/history";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { canvasDocuments } from "./Documents";
import { childText } from "../documents/ChildText";
import { createCanvasImage } from "./Images";
import { imageLimits } from "@pluribus/core/canvas/domain";
import { toElementId } from "./ElementLifecycles";
import type { CanvasActor } from "@pluribus/core/canvas/access";
import {
  historyLimits,
  HistoryProtocolError,
} from "@pluribus/core/canvas/history";

export function storedElement(ctx: QueryCtx, id: string) {
  const value =
    ctx.db.normalizeId("rectangles", id) ??
    ctx.db.normalizeId("canvasDocuments", id) ??
    ctx.db.normalizeId("sources", id) ??
    ctx.db.normalizeId("canvasImages", id);
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
export async function readHistoryElement(
  ctx: QueryCtx,
  id: import("@pluribus/core/canvas/domain").ElementId,
  scope: string,
) {
  const workspaceId =
    scope === "shared"
      ? undefined
      : (ctx.db.normalizeId("workspaces", scope) ?? undefined);

  if (ctx.db.normalizeId("rectangles", id)) return null;
  const imageId = ctx.db.normalizeId("canvasImages", id);
  if (imageId) {
    const image = await ctx.db.get(imageId);
    return image && image.workspaceId === workspaceId
      ? {
          id,
          kind: "image" as const,
          generation: image.generation,
          removed: image.removed,
          activeDeletion: image.activeDeletion ?? null,
          geometry: image.geometry,
        }
      : null;
  }
  const sourceId = ctx.db.normalizeId("sources", id);
  if (sourceId) {
    const source = await ctx.db.get(sourceId);
    return source && source.workspaceId === workspaceId
      ? {
          id,
          kind: "source" as const,
          generation: source.generation ?? 1,
          removed: source.removed ?? false,
          activeDeletion: source.activeDeletion ?? null,
          geometry: source.geometry ?? defaultSourceGeometry,
        }
      : null;
  }
  const stored = storedElement(ctx, id),
    row = await ctx.db.get(stored);
  if (
    !row ||
    !("x" in row) ||
    ("canvas" in row ? row.canvas !== scope : row.workspaceId !== workspaceId)
  )
    return null;
  return {
    id,
    kind: "document" as const,
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
}

/** Narrow session-bound adapters; one action never scans another session's history. */
export function historyPorts(
  ctx: MutationCtx,
  session: Id<"canvasHistorySessions">,
  actor: CanvasActor,
  scope = "shared",
  sourceMember?: Id<"users">,
): HistoryPorts {
  const workspaceId =
    scope === "shared"
      ? undefined
      : (ctx.db.normalizeId("workspaces", scope) ?? undefined);
  if (scope !== "shared" && !workspaceId)
    throw new Error("Invalid History scope");
  const documents = canvasDocuments(ctx, workspaceId);
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
      get: (id) => readHistoryElement(ctx, id, scope),
      create: (input) => {
        if (input.kind === "rectangle")
          throw new HistoryProtocolError("Rectangle elements are retired");
        if (input.kind === "image") {
          if (!workspaceId)
            throw new HistoryProtocolError("Images require a workspace");
          const uploadId = ctx.db.normalizeId(
            "imageUploadIntents",
            input.uploadId,
          );
          if (!uploadId) throw new HistoryProtocolError("Invalid image upload");
          return createCanvasImage(ctx, {
            workspaceId,
            uploadId,
            geometry: input.geometry,
          }).then(toElementId);
        }
        if (input.kind === "source") {
          if (!workspaceId)
            throw new HistoryProtocolError(
              "Web Pages require a private workspace",
            );
          const args = { workspaceId, ...input };
          return (
            sourceMember
              ? requestSourceForMember(ctx, args, sourceMember)
              : requestSource(ctx, args)
          ).then(toElementId);
        }
        return createCanvasDocument(
          { cards: documents, text: childText(ctx, workspaceId) },
          actor,
          input.geometry,
        );
      },
      count: (kind) =>
        kind === "rectangle"
          ? Promise.resolve(0)
          : kind === "image"
            ? workspaceId
              ? ctx.db
                  .query("canvasImages")
                  .withIndex("by_workspace_removed", (q) =>
                    q.eq("workspaceId", workspaceId).eq("removed", false),
                  )
                  .take(imageLimits.maxCount)
                  .then((rows) => rows.length)
              : Promise.resolve(0)
            : kind === "source"
              ? workspaceId
                ? activeSources(ctx, workspaceId).then((rows) => rows.length)
                : Promise.resolve(0)
              : documents.count(),
      geometry: (id, geometry) => {
        const source = ctx.db.normalizeId("sources", id);
        const image = ctx.db.normalizeId("canvasImages", id);
        return image
          ? ctx.db.patch(image, { geometry })
          : source
            ? ctx.db.patch(source, { geometry })
            : ctx.db.patch(storedElement(ctx, id), geometry);
      },
      async lifecycle(id, removed, generation, deletion) {
        const imageId = ctx.db.normalizeId("canvasImages", id);
        if (imageId) {
          await ctx.db.patch(imageId, {
            removed,
            generation,
            activeDeletion: deletion ?? undefined,
          });
          return;
        }
        const sourceId = ctx.db.normalizeId("sources", id);
        if (sourceId) {
          const row = await ctx.db.get(sourceId);
          if (!row) throw new HistoryProtocolError("Web Page unavailable");
          await ctx.db.patch(sourceId, {
            removed: removed ? true : undefined,
            generation,
            activeDeletion: deletion ?? undefined,
            // Invalidate in-flight provider work on deletion; restoration never auto-refetches.
            ...(removed
              ? {
                  revision: row.revision + 1,
                  ...(["queued", "fetching"].includes(row.status)
                    ? {
                        status: "failed" as const,
                        error:
                          "Capture interrupted by deletion. Refresh to retry.",
                      }
                    : {}),
                }
              : {}),
          });
          return;
        }
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
