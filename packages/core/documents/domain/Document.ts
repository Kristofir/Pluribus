import { assertCanvasAccess } from "../../canvas/domain/Access";
export type DocumentId = string & { readonly __documentId: unique symbol };
export type DocumentActor = { kind: "anonymous" } | { kind: "authenticated" };
export type SharedDocument = { id: DocumentId; access: "public" };

// The standalone shared document deliberately permits anonymous collaboration.
/**
 * Allow trusted anonymous and authenticated actors on public documents.
 * Reject unsupported access facts before adapter I/O.
 */
export function assertDocumentAccess(
  actor: DocumentActor,
  document: SharedDocument,
) {
  if (
    document.access !== "public" ||
    !["anonymous", "authenticated"].includes(actor.kind)
  ) {
    throw new Error("Document access denied");
  }
}

/** Child text inherits canvas access. Removed generations stay readable for local recovery, never writable. */
export function assertChildDocumentAccess(
  actor: DocumentActor,
  child: {
    canvas: string;
    documentMatches: boolean;
    removed: boolean;
    generation: number;
  } | null,
  requestedGeneration?: number,
  write = false,
) {
  if (!child || child.canvas !== "shared" || !child.documentMatches)
    throw new Error("Document ownership is invalid");
  assertCanvasAccess(actor);
  if (
    requestedGeneration !== undefined &&
    (!Number.isSafeInteger(requestedGeneration) || requestedGeneration < 1)
  )
    throw new Error("An editing generation is required");
  if (write && (child.removed || requestedGeneration !== child.generation))
    throw new Error("Document removed or editing session expired");
}
