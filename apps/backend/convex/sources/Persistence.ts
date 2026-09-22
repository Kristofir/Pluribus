import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Geometry } from "@pluribus/core/canvas/domain";
import { assertSourceGeometry } from "@pluribus/core/canvas/domain";
import {
  sourceLimits,
  type SourceTable,
  normalizeSourceTable,
  assertExtractionIntent,
  SourceExtractionIntentError,
  SourceInputError,
  sourceDeadlineMs,
  sourceIsBusy,
} from "@pluribus/core/sources/domain";
import { ConvexError } from "convex/values";
import { requireWorkspace } from "../workspaces/Access";
import { internal } from "../_generated/api";
import { publicSourceUrl } from "./Firecrawl";
import { defaultSourceGeometry } from "./Model";

/** Active rows only; deleted sources free capacity without discarding captures. */
export function activeSources(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("sources")
    .withIndex("by_workspace_removed", (q) =>
      q.eq("workspaceId", workspaceId).eq("removed", undefined),
    )
    .take(sourceLimits.maxCount);
}
/** Authorize and enqueue capture work atomically; refresh retains the last successful capture. */
export async function requestSource(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    url: string;
    prompt?: string;
    table?: SourceTable | null;
    sourceId?: Id<"sources">;
    geometry?: Geometry;
    expectedRevision?: number;
    replaceActive?: boolean;
  },
) {
  const { userId } = await requireWorkspace(ctx, args.workspaceId);
  let url: string;
  try {
    url = publicSourceUrl(args.url);
  } catch {
    throw new SourceInputError("Use a public HTTP or HTTPS page");
  }
  if ((args.prompt?.length ?? 0) > 2000)
    throw new SourceInputError("Extraction prompt too long");
  const prior = args.sourceId ? await ctx.db.get(args.sourceId) : null;
  if (
    args.sourceId &&
    (!prior || prior.workspaceId !== args.workspaceId || prior.removed)
  )
    throw new SourceInputError("Source outside workspace or removed");
  const prompt =
    args.prompt === undefined ? prior?.prompt : args.prompt.trim() || undefined;
  const table =
    args.table === undefined
      ? prior?.table
      : args.table === null
        ? undefined
        : normalizeSourceTable(args.table);
  try {
    assertExtractionIntent(prompt, table);
  } catch (error) {
    if (error instanceof SourceExtractionIntentError)
      throw new ConvexError({
        code: "SOURCE_EXTRACTION_INTENT_REQUIRED",
        message: error.message,
      });
    throw error;
  }
  const busy = prior && sourceIsBusy(prior.status);
  const live =
    busy && (prior.deadlineAt === undefined || prior.deadlineAt > Date.now());
  if (
    live &&
    prior.url === url &&
    prior.prompt === prompt &&
    JSON.stringify(prior.table) === JSON.stringify(table)
  )
    return prior._id;
  if (
    args.expectedRevision !== undefined &&
    prior?.revision !== args.expectedRevision
  )
    throw new ConvexError({
      code: "SOURCE_REVISION_CONFLICT",
      message:
        "This Web Page changed. Reload its current request before trying again.",
    });
  if (live && (!args.replaceActive || args.expectedRevision === undefined))
    throw new ConvexError({
      code: "SOURCE_REQUEST_ACTIVE",
      message:
        "A capture is already active. Wait for it or explicitly replace its current revision.",
    });
  const rows = prior ? [] : await activeSources(ctx, args.workspaceId);
  if (!prior && rows.length >= sourceLimits.maxCount)
    throw new SourceInputError("This workspace supports 20 Web Pages");
  const geometry = prior?.geometry ??
    args.geometry ?? { ...defaultSourceGeometry, x: 80 + rows.length * 440 };
  assertSourceGeometry(geometry);
  const revision = (prior?.revision ?? 0) + 1;
  const value = {
    workspaceId: args.workspaceId,
    userId,
    url,
    prompt,
    table,
    status: "queued" as const,
    revision,
    error: undefined,
    deadlineAt: Date.now() + sourceDeadlineMs,
  };
  const id =
    prior?._id ??
    (await ctx.db.insert("sources", { ...value, geometry, generation: 1 }));
  if (prior)
    await ctx.db.patch(id, {
      ...value,
      capture: prior.capture
        ? {
            ...prior.capture,
            url: prior.capture.url ?? prior.url,
            // A stored URL marks request provenance as captured. Missing prompt
            // then means an intentionally unprompted capture, not legacy data.
            prompt:
              prior.capture.url === undefined
                ? (prior.capture.prompt ?? prior.prompt)
                : prior.capture.prompt,
          }
        : undefined,
    });
  await ctx.scheduler.runAfter(0, internal.sources.Jobs.fetch, {
    id,
    revision,
  });
  await ctx.scheduler.runAt(value.deadlineAt, internal.sources.Jobs.expire, {
    id,
    revision,
  });
  return id;
}

/** Idempotent recovery: never starts a provider request or touches a newer revision. */
export async function expireSource(
  ctx: MutationCtx,
  id: Id<"sources">,
  revision: number,
  allowLegacy = false,
) {
  const row = await ctx.db.get(id);
  if (
    !row ||
    row.removed ||
    row.revision !== revision ||
    !sourceIsBusy(row.status)
  )
    return false;
  if (row.deadlineAt === undefined ? !allowLegacy : row.deadlineAt > Date.now())
    return false;
  await ctx.db.patch(id, {
    status: "failed",
    deadlineAt: undefined,
    error: "Capture interrupted or exceeded its time limit. Refresh to retry.",
  });
  return true;
}
