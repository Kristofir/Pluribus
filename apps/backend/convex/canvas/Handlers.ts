import { documentLimits } from "@pluribus/core/canvas/domain";
import { canvasScope } from "../workspaces/Access";
import {
  createCanvasDocument,
  changeCanvasDocument,
  type DocumentChange,
} from "@pluribus/core/canvas/documents";
import {
  canvasDocuments,
  spatialDocuments,
  toDocumentElementId,
} from "./Documents";
import { childText } from "../documents/ChildText";
import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { assertCanvasAccess } from "@pluribus/core/canvas/access";
import type { color, geometry as geometryValidator } from "./Model";
import { canvasActor } from "./Actor";
/** Retired rectangle endpoint: old clients receive an empty scene without deleting stored rows. */
export async function list(
  ctx: QueryCtx,
  args: { workspaceId?: Id<"workspaces"> } = {},
) {
  await canvasScope(ctx, args.workspaceId);
  return [];
}
export async function create(
  ctx: MutationCtx,
  args: {
    workspaceId?: Id<"workspaces">;
    geometry: Infer<typeof geometryValidator>;
    color: Infer<typeof color>;
  },
): Promise<Id<"rectangles">> {
  await canvasScope(ctx, args.workspaceId);
  throw new Error("Rectangle elements are retired");
}
export async function updateGeometry(
  ctx: MutationCtx,
  args: {
    workspaceId?: Id<"workspaces">;
    id: Id<"rectangles">;
    generation: number;
    geometry: Infer<typeof geometryValidator>;
  },
) {
  await canvasScope(ctx, args.workspaceId);
  return false;
}
export async function createDocument(
  ctx: MutationCtx,
  args: {
    geometry: Infer<typeof geometryValidator>;
    workspaceId?: Id<"workspaces">;
  },
) {
  await canvasScope(ctx, args.workspaceId);
  const id = await createCanvasDocument(
    {
      cards: canvasDocuments(ctx, args.workspaceId),
      text: childText(ctx, args.workspaceId),
    },
    await canvasActor(ctx),
    args.geometry,
  );
  const stored = ctx.db.normalizeId("canvasDocuments", id);
  if (!stored) throw new Error("Invalid child");
  return stored;
}
export async function documentCards(
  ctx: QueryCtx,
  args: { workspaceId?: Id<"workspaces"> } = {},
) {
  await canvasScope(ctx, args.workspaceId);
  assertCanvasAccess(await canvasActor(ctx));
  const rows = await spatialDocuments(
    ctx,
    args.workspaceId ?? "shared",
    documentLimits.maxCount,
  );
  return rows.map((r) => {
    if (!("x" in r) || !r.documentId)
      throw new Error("Incomplete document child");
    return {
      id: r._id,
      documentId: r.documentId,
      geometry: { x: r.x, y: r.y, width: r.width, height: r.height },
      generation: r.generation,
      removed: r.removed,
    };
  });
}
export async function changeDocument(
  ctx: MutationCtx,
  args: {
    workspaceId?: Id<"workspaces">;
    id: Id<"canvasDocuments">;
    generation: number;
    change: DocumentChange;
  },
) {
  await canvasScope(ctx, args.workspaceId);
  return changeCanvasDocument(
    { cards: canvasDocuments(ctx, args.workspaceId) },
    await canvasActor(ctx),
    toDocumentElementId(args.id),
    args.generation,
    args.change,
  );
}
