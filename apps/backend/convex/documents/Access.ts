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
) {
  const [documentId, generationText, extra] = rawId.split(":");
  if (extra !== undefined) throw new Error("Invalid document identity");
  const id = ctx.db.normalizeId("documents", documentId);
  const document = id && (await ctx.db.get("documents", id));
  if (!document) throw new Error("Document not found");
  assertDocumentAccess(await documentActor(ctx), {
    id: toDocumentId(document._id),
    access: document.access,
  });
  if (document.element) {
    const child = await ctx.db.get(document.element);
    assertChildDocumentAccess(
      await documentActor(ctx),
      child
        ? { ...child, documentMatches: child.documentId === document._id }
        : null,
      Number(generationText),
      write,
    );
  } else if (generationText !== undefined)
    throw new Error("Invalid standalone document identity");
  return document;
}
