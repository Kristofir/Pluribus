import {
  assertDocumentAccess,
  type DocumentActor,
  type SharedDocument,
} from "../domain/Document";

/**
 * Core port for shared-document initialization. Lookup, metadata creation, and
 * initial content must be transactional; editor formats stay in the adapter.
 */
export interface SharedDocumentPersistence {
  findShared(): Promise<SharedDocument | null>;
  createShared(): Promise<SharedDocument>;
}

/**
 * Reuse or initialize the shared document and enforce access. The adapter must
 * keep lookup and creation transactional so concurrent opens share one identity.
 */
export async function ensureSharedDocument(
  actor: DocumentActor,
  persistence: SharedDocumentPersistence,
) {
  const existing = await persistence.findShared();
  if (existing) {
    assertDocumentAccess(actor, existing);
    return existing;
  }
  const created = await persistence.createShared();
  assertDocumentAccess(actor, created);
  return created;
}
