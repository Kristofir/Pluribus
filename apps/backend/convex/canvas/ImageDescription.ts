import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { requireWorkspaceMember } from "../workspaces/Access";

const imageId = { imageId: v.id("canvasImages") };

/** Check the durable card and its owner's current access before sending image bytes. */
export const begin = internalMutation({
  args: imageId,
  returns: v.union(
    v.null(),
    v.object({ storageId: v.id("_storage"), contentType: v.string() }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.imageId);
    if (!row || row.removed || row.aiDescriptionStatus !== "pending")
      return null;
    await requireWorkspaceMember(ctx, row.workspaceId, row.userId);
    const metadata = await ctx.db.system.get(row.storageId);
    const intent = await ctx.db.get(row.uploadId);
    const contentType = metadata?.contentType ?? intent?.importedType;
    if (
      !contentType ||
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
        contentType,
      )
    )
      return null;
    await ctx.db.patch(row._id, { aiDescriptionStatus: "generating" });
    return { storageId: row.storageId, contentType };
  },
});

export const complete = internalMutation({
  args: {
    ...imageId,
    status: v.union(
      v.literal("ready"),
      v.literal("unavailable"),
      v.literal("failed"),
    ),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.imageId);
    if (
      !row ||
      !["pending", "generating"].includes(row.aiDescriptionStatus ?? "")
    )
      return null;
    await ctx.db.patch(row._id, {
      aiDescriptionStatus: args.status,
      aiDescription: args.status === "ready" ? args.description : undefined,
    });
    return null;
  },
});
