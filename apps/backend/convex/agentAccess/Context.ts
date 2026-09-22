import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../workspaces/Access";
import { readParagraphs } from "../documents/Paragraphs";
import { requireGrant } from "./Access";
export async function prepareContext(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    elementIds: (Id<"canvasDocuments"> | Id<"sources">)[];
    passages: {
      documentId: Id<"documents">;
      paragraphId: string;
      version: number;
    }[];
  },
) {
  const { userId } = await requireWorkspace(ctx, args.workspaceId);
  if (
    args.elementIds.length > 30 ||
    args.passages.length > 30 ||
    !(args.elementIds.length + args.passages.length)
  )
    throw new Error("Select between 1 and 30 cards or passages per kind");
  const documentIds = new Set<Id<"documents">>();
  const elements = [];
  for (const id of [...new Set(args.elementIds)]) {
    const sourceId = ctx.db.normalizeId("sources", id);
    if (sourceId) {
      const source = await ctx.db.get(sourceId);
      if (
        !source ||
        source.workspaceId !== args.workspaceId ||
        source.removed ||
        !source.capture
      )
        throw new Error("Selected source unavailable");
      elements.push({
        elementId: id,
        kind: "source",
        url: source.capture.url ?? source.url,
        revision: source.revision,
        capture: source.capture,
      });
      continue;
    }
    const spatialId = ctx.db.normalizeId("canvasDocuments", id);
    if (!spatialId) throw new Error("Invalid selected Element");
    const element = await ctx.db.get(spatialId);
    if (
      !element ||
      !("x" in element) ||
      element.removed ||
      element.canvas !== args.workspaceId
    )
      throw new Error("Selected Element unavailable");
    if (!element.documentId) throw new Error("Document unavailable");
    const doc = await readParagraphs(ctx, element.documentId);
    documentIds.add(element.documentId);
    elements.push({ elementId: id, kind: "document", document: doc });
  }
  const passages = [];
  for (const passage of args.passages) {
    const current = await readParagraphs(ctx, passage.documentId);
    if (current.canvasId !== args.workspaceId)
      throw new Error("Passage outside workspace");
    if (current.version !== passage.version)
      throw new Error("Selected passage changed; select it again");
    const paragraph = current.paragraphs.find(
      (p) => p.paragraphId === passage.paragraphId,
    );
    if (!paragraph) throw new Error("Selected paragraph no longer exists");
    documentIds.add(passage.documentId);
    passages.push({
      ...passage,
      generation: current.generation,
      text: paragraph.text,
    });
  }
  const content = JSON.stringify({ elements, passages });
  if (new TextEncoder().encode(content).byteLength > 100000)
    throw new Error("Selected context too large");
  return ctx.db.insert("agentContexts", {
    workspaceId: args.workspaceId,
    userId,
    documentIds: [...documentIds],
    content,
  });
}
export async function readContext(
  ctx: QueryCtx,
  args: { token: string; contextSnapshotId: Id<"agentContexts"> },
) {
  const grant = await requireGrant(ctx, args.token),
    context = await ctx.db.get(args.contextSnapshotId);
  if (
    !context ||
    context.workspaceId !== grant.workspaceId ||
    context.userId !== grant.userId ||
    context.documentIds.some((id) => !grant.documentIds.includes(id))
  )
    throw new Error("Context outside grant");
  assertActiveContext(context.content);
  return context.content;
}

/** Retained snapshots remain immutable, but retired Elements cannot enter new agent work. */
export function assertActiveContext(content: string) {
  const snapshot = JSON.parse(content) as { elements?: { kind?: string }[] };
  if (snapshot.elements?.some((e) => e.kind === "rectangle"))
    throw new Error(
      "Context contains retired Elements; prepare a new selection",
    );
}
