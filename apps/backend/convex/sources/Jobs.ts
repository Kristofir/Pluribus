import {
  storeScreenshot,
  registerScreenshot as registerScreenshotAsset,
  discardPendingScreenshot,
  acceptScreenshot,
} from "./Screenshot";
import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireWorkspaceMember } from "../workspaces/Access";
import { canCompleteSource } from "@pluribus/core/sources/domain";
import { capture, sourceTable } from "./Model";
import { scrapePage, captureFailureMessage } from "./Firecrawl";
import { expireSource } from "./Persistence";
const identity = { id: v.id("sources"), revision: v.number() };
export const expire = internalMutation({
  args: identity,
  returns: v.boolean(),
  handler: (ctx, args) => expireSource(ctx, args.id, args.revision),
});
export const begin = internalMutation({
  args: identity,
  returns: v.union(
    v.null(),
    v.object({
      url: v.string(),
      prompt: v.optional(v.string()),
      table: v.optional(sourceTable),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.removed ||
      row.revision !== args.revision ||
      row.status !== "queued"
    )
      return null;
    if (await expireSource(ctx, args.id, args.revision)) return null;
    try {
      await requireWorkspaceMember(ctx, row.workspaceId, row.userId);
    } catch {
      await ctx.db.patch(row._id, {
        status: "failed",
        error: "Workspace access changed",
        deadlineAt: undefined,
      });
      return null;
    }
    await ctx.db.patch(row._id, { status: "fetching" });
    return { url: row.url, prompt: row.prompt, table: row.table };
  },
});
export const complete = internalMutation({
  args: {
    ...identity,
    capture: v.optional(capture),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    const reject = async () => {
      const file = args.capture?.screenshot?.storageId;
      if (file && file !== row?.capture?.screenshot?.storageId)
        await discardPendingScreenshot(ctx, file);
      return null;
    };
    if (!row || !canCompleteSource(row, args.revision)) return reject();
    if (await expireSource(ctx, args.id, args.revision)) return reject();
    if (
      args.capture &&
      args.capture.content.length + (args.capture.data?.length ?? 0) > 150000
    )
      throw new Error("Capture too large");
    if (args.capture?.screenshot)
      await acceptScreenshot(ctx, args.capture.screenshot.storageId);
    await ctx.db.patch(
      row._id,
      args.capture
        ? {
            status: "ready",
            capture: {
              ...args.capture,
              url: row.url,
              prompt: row.prompt,
              table: row.table,
            },
            error: undefined,
            deadlineAt: undefined,
          }
        : {
            status: "failed",
            deadlineAt: undefined,
            error: args.error ?? "Retrieval failed",
          },
    );
    return null;
  },
});
export const fetch = internalAction({
  args: identity,
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.runMutation(internal.sources.Jobs.begin, args);
    if (!request) return null;
    try {
      const { screenshotUrl, ...result } = await scrapePage(request);
      if (result.content.length + (result.data?.length ?? 0) > 150000)
        throw new Error("Capture too large");
      const image = await storeScreenshot(ctx, screenshotUrl);
      await ctx.runMutation(internal.sources.Jobs.complete, {
        ...args,
        capture: {
          ...result,
          ...image,
          url: request.url,
          prompt: request.prompt,
          id: crypto.randomUUID(),
          capturedAt: Date.now(),
        },
      });
    } catch (error) {
      await ctx.runMutation(internal.sources.Jobs.complete, {
        ...args,
        error: captureFailureMessage(error),
      });
    }
    return null;
  },
});

export const registerScreenshot = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    await registerScreenshotAsset(ctx, storageId);
    return null;
  },
});
export const cleanupScreenshot = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    await discardPendingScreenshot(ctx, storageId);
    return null;
  },
});
