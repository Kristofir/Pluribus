import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireWorkspace } from "../workspaces/Access";
import { imageLimits, imageTypes } from "@pluribus/core/canvas/domain";

export const authorize = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspace(ctx, workspaceId);
    return null;
  },
});

/** The storage ID and MIME type come from our URL-fetch action, never a browser claim. */
export const register = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
  },
  returns: v.id("imageUploadIntents"),
  handler: async (ctx, args) => {
    const { userId } = await requireWorkspace(ctx, args.workspaceId);
    const metadata = await ctx.db.system.get(args.storageId);
    if (
      !metadata ||
      metadata.size <= 0 ||
      metadata.size > imageLimits.maxBytes ||
      !imageTypes.includes(args.contentType as (typeof imageTypes)[number]) ||
      (metadata.contentType && metadata.contentType !== args.contentType)
    )
      throw new Error("Invalid imported image");
    const uploadId = await ctx.db.insert("imageUploadIntents", {
      workspaceId: args.workspaceId,
      userId,
      storageId: args.storageId,
      name: args.name.trim().slice(0, 120) || "Image",
      importedType: args.contentType,
    });
    await ctx.scheduler.runAfter(
      2 * 60 * 60 * 1000,
      internal.Canvas.cleanupImageUpload,
      {
        uploadId,
      },
    );
    return uploadId;
  },
});
