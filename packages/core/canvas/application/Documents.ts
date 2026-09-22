import { documentLimits } from "../domain/Document";
import { assertDocumentGeometry, type Geometry } from "../domain/Geometry";
import { assertCanvasAccess, type CanvasActor } from "../domain/Access";
import type { DocumentElement, DocumentElementId } from "../domain/Element";
import type { DocumentId } from "../../documents/domain/Document";

export interface CanvasDocuments {
  count(): Promise<number>;
  insert(geometry: Geometry): Promise<DocumentElementId>;
  attach(id: DocumentElementId, document: DocumentId): Promise<void>;
  get(
    id: DocumentElementId,
  ): Promise<Pick<DocumentElement, "id" | "generation" | "removed"> | null>;
  geometry(id: DocumentElementId, geometry: Geometry): Promise<void>;
  lifecycle(
    id: DocumentElementId,
    removed: boolean,
    generation: number,
  ): Promise<void>;
}
export interface ChildText {
  create(owner: DocumentElementId): Promise<DocumentId>;
}
export type DocumentChange = { kind: "geometry"; geometry: Geometry };

/** Both ports must share one transaction: failure leaves neither an orphan nor an empty card. */
export async function createCanvasDocument(
  { cards, text }: { cards: CanvasDocuments; text: ChildText },
  actor: CanvasActor,
  geometry: Geometry,
) {
  assertCanvasAccess(actor);
  assertDocumentGeometry(geometry);
  // Deleted children retain recovery data but do not occupy active canvas capacity.
  if ((await cards.count()) >= documentLimits.maxCount)
    throw new Error(
      `This canvas supports ${documentLimits.maxCount} active document cards.`,
    );
  const id = await cards.insert(geometry);
  await cards.attach(id, await text.create(id));
  return id;
}
export async function changeCanvasDocument(
  { cards }: { cards: CanvasDocuments },
  actor: CanvasActor,
  id: DocumentElementId,
  generation: number,
  change: DocumentChange,
) {
  assertCanvasAccess(actor);
  const current = await cards.get(id);
  if (!current || current.generation !== generation) return false;
  assertDocumentGeometry(change.geometry);
  if (current.removed) return false;
  await cards.geometry(id, change.geometry);
  return true;
}
