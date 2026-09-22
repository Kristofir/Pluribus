import { requireWorkspace, requireWorkspaceMember } from "../workspaces/Access";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assertDocumentAccess,
  assertChildDocumentAccess,
  type DocumentActor,
  type DocumentId,
} from "@pluribus/core/documents/domain";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function documentActor(
  ctx: Pick<QueryCtx, "auth">,
): Promise<DocumentActor> {
  return (await getAuthUserId(ctx)) === null
    ? { kind: "anonymous" }
    : { kind: "authenticated" };
}
export function toDocumentId(id: Id<"documents">): DocumentId {
  return id as string as DocumentId;
}
/**
 * Validate a sync ID, load application metadata, and enforce core access before
 * component operations. Malformed IDs, missing records, and denied access throw.
 */
export async function requireDocument(
  ctx: QueryCtx,
  rawId: string,
  write = false,
  delegatedUser?: Id<"users">,
) {
  const [documentId, generationText, extra] = rawId.split(":");
  if (extra !== undefined) throw new Error("Invalid document identity");
  const id = ctx.db.normalizeId("documents", documentId);
  const document = id && (await ctx.db.get("documents", id));
  if (!document) throw new Error("Document not found");
  if (document.access === "workspace") {
    if (!document.workspaceId || !document.element)
      throw new Error("Invalid private document ownership");
    if (delegatedUser)
      await requireWorkspaceMember(ctx, document.workspaceId, delegatedUser);
    else await requireWorkspace(ctx, document.workspaceId);
  } else {
    if (document.workspaceId)
      throw new Error("Invalid public document ownership");
    assertDocumentAccess(await documentActor(ctx), {
      id: toDocumentId(document._id),
      access: document.access,
    });
  }
  if (document.element) {
    const child = await ctx.db.get(document.element);
    assertChildDocumentAccess(
      await documentActor(ctx),
      child
        ? { ...child, documentMatches: child.documentId === document._id }
        : null,
      generationText === undefined ? undefined : Number(generationText),
      write,
      document.workspaceId ?? "shared",
    );
  } else if (generationText !== undefined)
    throw new Error("Invalid standalone document identity");
  return document;
}
