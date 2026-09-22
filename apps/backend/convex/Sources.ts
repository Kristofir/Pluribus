import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireWorkspace } from "./workspaces/Access";
import {
  sourceStatus,
  captureView,
  screenshotView,
  sourceTable,
  defaultSourceGeometry,
} from "./sources/Model";
import {
  activeSources,
  requestSource,
  expireSource,
} from "./sources/Persistence";
import { geometry } from "./canvas/Model";
import { assertSourceGeometry } from "@pluribus/core/canvas/domain";

const sourceFields = {
  id: v.id("sources"),
  canvasId: v.string(),
  url: v.string(),
  prompt: v.optional(v.string()),
  table: v.optional(sourceTable),
  status: sourceStatus,
  generation: v.number(),
  geometry,
  error: v.optional(v.string()),
  revision: v.number(),
  deadlineAt: v.optional(v.number()),
};
const fullSource = v.object({
  ...sourceFields,
  capture: v.optional(captureView),
});
const previewCapture = v.object({
  id: v.string(),
  capturedAt: v.number(),
  title: v.optional(v.string()),
  url: v.optional(v.string()),
  prompt: v.optional(v.string()),
  table: v.optional(sourceTable),
  preview: v.string(),
  screenshot: v.optional(screenshotView),
  screenshotError: v.optional(v.string()),
  extractionFormat: v.optional(v.literal("inferred-v1")),
});
/** Full captures for the existing sources tool; canvas uses the compact cards projection. */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(fullSource),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return Promise.all(
      (await activeSources(ctx, args.workspaceId)).map((row) => view(ctx, row)),
    );
  },
});
export const cards = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({ ...sourceFields, capture: v.optional(previewCapture) }),
  ),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return Promise.all(
      (await activeSources(ctx, args.workspaceId)).map(async (row) => {
        const { capture: stored, ...base } = await view(ctx, row);
        return {
          ...base,
          capture: stored
            ? {
                id: stored.id,
                capturedAt: stored.capturedAt,
                title: stored.title,
                url: stored.url ?? row.url,
                prompt: stored.prompt,
                table: stored.table,
                extractionFormat: stored.extractionFormat,
                screenshot: stored.screenshot,
                screenshotError: stored.screenshotError,
                preview: stored.content.slice(0, 500),
              }
            : undefined,
        };
      }),
    );
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), id: v.id("sources") },
  returns: v.union(fullSource, v.null()),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const row = await ctx.db.get(args.id);
    return row && row.workspaceId === args.workspaceId && !row.removed
      ? view(ctx, row)
      : null;
  },
});
export const request = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    url: v.string(),
    prompt: v.optional(v.string()),
    table: v.optional(v.union(sourceTable, v.null())),
    sourceId: v.optional(v.id("sources")),
    geometry: v.optional(geometry),
    expectedRevision: v.optional(v.number()),
    replaceActive: v.optional(v.boolean()),
  },
  returns: v.id("sources"),
  handler: requestSource,
});
/** Re-enable manual retry after an overdue or pre-deadline-support capture. */
export const recover = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("sources"),
    revision: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const row = await ctx.db.get(args.id);
    if (!row || row.workspaceId !== args.workspaceId) return false;
    return expireSource(ctx, args.id, args.revision, true);
  },
});
/** Generation-scoped compatibility write; interactive gestures use Canvas History. */
export const changeGeometry = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("sources"),
    generation: v.number(),
    geometry,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.workspaceId !== args.workspaceId ||
      row.removed ||
      (row.generation ?? 1) !== args.generation
    )
      return false;
    assertSourceGeometry(args.geometry);
    await ctx.db.patch(row._id, { geometry: args.geometry });
    return true;
  },
});
async function view(
  ctx: import("./_generated/server").QueryCtx,
  row: import("./_generated/dataModel").Doc<"sources">,
) {
  return {
    id: row._id,
    canvasId: String(row.workspaceId),
    url: row.url,
    prompt: row.prompt,
    table: row.table,
    status: row.status,
    capture: row.capture
      ? {
          ...row.capture,
          screenshot: row.capture.screenshot
            ? {
                url: await ctx.storage.getUrl(row.capture.screenshot.storageId),
                width: row.capture.screenshot.width,
                height: row.capture.screenshot.height,
              }
            : undefined,
        }
      : undefined,
    error: row.error,
    revision: row.revision,
    deadlineAt: row.deadlineAt,
    geometry: row.geometry ?? defaultSourceGeometry,
    generation: row.generation ?? 1,
  };
}
