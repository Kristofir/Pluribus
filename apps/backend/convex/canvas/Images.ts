import {
  imageLimits,
  imageTypes,
  assertElementGeometry,
  type Geometry,
} from "@pluribus/core/canvas/domain";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireWorkspace } from "../workspaces/Access";
import { internal } from "../_generated/api";

const validImage = (metadata: { contentType?: string; size: number }) =>
  metadata.size > 0 &&
  metadata.size <= imageLimits.maxBytes &&
  imageTypes.includes(metadata.contentType as (typeof imageTypes)[number]);

export async function prepareImageUpload(
  ctx: MutationCtx,
  args: { workspaceId: Id<"workspaces"> },
) {
  const { userId, workspace } = await requireWorkspace(ctx, args.workspaceId);
  if (workspace.demo === "landing")
    throw new Error("Image upload is unavailable in the landing demo");
  const uploadId = await ctx.db.insert("imageUploadIntents", {
    workspaceId: args.workspaceId,
    userId,
  });
  await ctx.scheduler.runAfter(
    2 * 60 * 60 * 1000,
    internal.Canvas.cleanupImageUpload,
    { uploadId },
  );
  return { uploadId, url: await ctx.storage.generateUploadUrl() };
}

/** Unclaimed files and expired upload intents do not accumulate indefinitely. */
export async function cleanupImageUpload(
  ctx: MutationCtx,
  args: { uploadId: Id<"imageUploadIntents"> },
) {
  const intent = await ctx.db.get(args.uploadId);
  if (!intent || intent.imageId) return null;
  if (intent.storageId && (await ctx.db.system.get(intent.storageId))) {
    const referenced = await ctx.db
      .query("canvasImages")
      .withIndex("by_storage", (q) => q.eq("storageId", intent.storageId!))
      .first();
    if (!referenced) await ctx.storage.delete(intent.storageId);
  }
  await ctx.db.delete(intent._id);
  return null;
}

async function ownIntent(ctx: QueryCtx, uploadId: Id<"imageUploadIntents">) {
  const intent = await ctx.db.get(uploadId);
  if (!intent) throw new Error("Upload unavailable");
  const { userId } = await requireWorkspace(ctx, intent.workspaceId);
  if (
    userId !== intent.userId ||
    Date.now() - intent._creationTime > 60 * 60 * 1000
  )
    throw new Error("Upload expired or belongs to another user");
  return intent;
}

export async function registerImageUpload(
  ctx: MutationCtx,
  args: {
    uploadId: Id<"imageUploadIntents">;
    storageId: Id<"_storage">;
    name: string;
  },
) {
  const intent = await ownIntent(ctx, args.uploadId);
  const name = args.name.trim().slice(0, 120) || "Image";
  if (intent.imageId) throw new Error("Upload already used");
  if (
    intent.storageId &&
    (intent.storageId !== args.storageId || intent.name !== name)
  )
    throw new Error("Upload already registered");
  const claimed = await ctx.db
    .query("imageUploadIntents")
    .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
    .unique();
  if (claimed && claimed._id !== intent._id)
    throw new Error("Image upload already belongs to another request");
  const metadata = await ctx.db.system.get(args.storageId);
  if (!metadata) throw new Error("Image upload unavailable");
  if (!intent.storageId)
    await ctx.db.patch(intent._id, {
      storageId: args.storageId,
      name,
    });
  return validImage(metadata);
}

export async function discardImageUpload(
  ctx: MutationCtx,
  args: { uploadId: Id<"imageUploadIntents"> },
) {
  const intent = await ownIntent(ctx, args.uploadId);
  if (intent.imageId) return false;
  if (intent.storageId && (await ctx.db.system.get(intent.storageId))) {
    const referenced = await ctx.db
      .query("canvasImages")
      .withIndex("by_storage", (q) => q.eq("storageId", intent.storageId!))
      .first();
    if (!referenced) await ctx.storage.delete(intent.storageId);
  }
  await ctx.db.delete(intent._id);
  return true;
}

export async function createCanvasImage(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    uploadId: Id<"imageUploadIntents">;
    geometry: Geometry;
  },
) {
  assertElementGeometry(args.geometry);
  const intent = await ownIntent(ctx, args.uploadId);
  if (
    intent.workspaceId !== args.workspaceId ||
    intent.imageId ||
    !intent.storageId
  )
    throw new Error("Image upload is not ready");
  const metadata = await ctx.db.system.get(intent.storageId);
  if (
    !metadata ||
    !(
      validImage(metadata) ||
      (intent.importedType &&
        metadata.size > 0 &&
        metadata.size <= imageLimits.maxBytes &&
        imageTypes.includes(
          intent.importedType as (typeof imageTypes)[number],
        ) &&
        (!metadata.contentType || metadata.contentType === intent.importedType))
    )
  )
    throw new Error("Invalid image upload");
  const rows = await ctx.db
    .query("canvasImages")
    .withIndex("by_workspace_removed", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("removed", false),
    )
    .take(imageLimits.maxCount);
  if (rows.length >= imageLimits.maxCount)
    throw new Error("Image card limit reached");
  const id = await ctx.db.insert("canvasImages", {
    workspaceId: args.workspaceId,
    userId: intent.userId,
    uploadId: intent._id,
    storageId: intent.storageId,
    name: intent.name ?? "Image",
    aiDescriptionStatus: "pending",
    geometry: args.geometry,
    generation: 1,
    removed: false,
  });
  await ctx.db.patch(intent._id, { imageId: id });
  await ctx.scheduler.runAfter(
    0,
    internal.canvas.ImageDescriptionJob.generate,
    {
      imageId: id,
    },
  );
  return id;
}

export async function imageCards(
  ctx: QueryCtx,
  args: { workspaceId: Id<"workspaces"> },
) {
  await requireWorkspace(ctx, args.workspaceId);
  const rows = await ctx.db
    .query("canvasImages")
    .withIndex("by_workspace_removed", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("removed", false),
    )
    .take(imageLimits.maxCount);
  return Promise.all(
    rows.map(async (row) => ({
      id: row._id,
      uploadId: row.uploadId,
      name: row.name,
      aiDescription: row.aiDescription ?? null,
      aiDescriptionStatus: row.aiDescriptionStatus ?? "unavailable",
      url: await ctx.storage.getUrl(row.storageId),
      geometry: row.geometry,
      generation: row.generation,
    })),
  );
}

export async function changeImage(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    id: Id<"canvasImages">;
    generation: number;
    geometry: Geometry;
  },
) {
  await requireWorkspace(ctx, args.workspaceId);
  assertElementGeometry(args.geometry);
  const row = await ctx.db.get(args.id);
  if (
    !row ||
    row.workspaceId !== args.workspaceId ||
    row.removed ||
    row.generation !== args.generation
  )
    return false;
  await ctx.db.patch(args.id, { geometry: args.geometry });
  return true;
}
