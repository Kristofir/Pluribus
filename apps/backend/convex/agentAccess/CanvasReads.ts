import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { activeSources } from "../sources/Persistence";
import { defaultSourceGeometry } from "../sources/Model";
import { spatialDocuments } from "../canvas/Documents";
import { documentLimits, imageLimits } from "@pluribus/core/canvas/domain";
import { requireGrant } from "./Access";

/** A canvas grant reveals layout and Web Page captures, but not ungranted document text. */
async function requireCanvasRead(ctx: QueryCtx, token: string) {
  const grant = await requireGrant(ctx, token);
  if (!grant.workspaceScope && !grant.canvasRead)
    throw new Error("Canvas read outside grant");
  return grant;
}

export async function readAgentCanvas(ctx: QueryCtx, args: { token: string }) {
  const grant = await requireCanvasRead(ctx, args.token);
  if (!(await ctx.db.get(grant.workspaceId)))
    throw new Error("Workspace unavailable");
  const cards = await spatialDocuments(
    ctx,
    String(grant.workspaceId),
    documentLimits.maxCount,
  );
  const sources = await activeSources(ctx, grant.workspaceId);
  const images = await ctx.db
    .query("canvasImages")
    .withIndex("by_workspace_removed", (q) =>
      q.eq("workspaceId", grant.workspaceId).eq("removed", false),
    )
    .take(imageLimits.maxCount);
  return {
    workspaceId: grant.workspaceId,
    elements: [
      ...cards.flatMap((card) =>
        "x" in card &&
        card.documentId &&
        (card.role === undefined || card.role === "card")
          ? [
              {
                kind: "document" as const,
                id: card._id,
                documentId: card.documentId,
                geometry: {
                  x: card.x,
                  y: card.y,
                  width: card.width,
                  height: card.height,
                },
                generation: card.generation,
                canReadContent:
                  grant.workspaceScope ||
                  grant.documentIds.includes(card.documentId),
              },
            ]
          : [],
      ),
      ...sources.map((source) => ({
        kind: "web_page" as const,
        id: source._id,
        geometry: source.geometry ?? defaultSourceGeometry,
        generation: source.generation ?? 1,
        url: source.url,
        status: source.status,
        revision: source.revision,
        title: source.capture?.title,
      })),
      ...images.map((image) => ({
        kind: "image" as const,
        id: image._id,
        geometry: image.geometry,
        generation: image.generation,
        name: image.name,
        aiDescription: image.aiDescription,
      })),
    ],
  };
}

export async function readAgentWebPage(
  ctx: QueryCtx,
  args: { token: string; sourceId: Id<"sources"> },
) {
  const grant = await requireCanvasRead(ctx, args.token);
  const source = await ctx.db.get(args.sourceId);
  if (!source || source.workspaceId !== grant.workspaceId || source.removed)
    throw new Error("Web Page outside grant");
  return {
    sourceId: source._id,
    url: source.url,
    prompt: source.prompt,
    status: source.status,
    revision: source.revision,
    error: source.error,
    capture: source.capture
      ? {
          id: source.capture.id,
          capturedAt: source.capture.capturedAt,
          url: source.capture.url,
          title: source.capture.title,
          content: source.capture.content,
          data: source.capture.data,
          extractionFormat: source.capture.extractionFormat,
        }
      : null,
  };
}
