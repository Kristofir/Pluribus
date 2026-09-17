import { assertElementGeometry, type Geometry } from "../domain/Geometry";
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
/** Both ports must share one transaction: failure leaves neither an orphan nor an empty card. */
export async function createCanvasDocument(
  actor: CanvasActor,
  cards: CanvasDocuments,
  text: ChildText,
  geometry: Geometry,
) {
  assertCanvasAccess(actor);
  assertElementGeometry(geometry);
  // Retained removed children count too, bounding storage and mounted editor lifetime.
  if ((await cards.count()) >= 2)
    throw new Error(
      "This experiment supports two document cards. Restore a removed card.",
    );
  const id = await cards.insert(geometry);
  await cards.attach(id, await text.create(id));
  return id;
}
export async function changeCanvasDocument(
  actor: CanvasActor,
  cards: CanvasDocuments,
  id: DocumentElementId,
  generation: number,
  change:
    { kind: "geometry"; geometry: Geometry } | { kind: "remove" | "restore" },
) {
  assertCanvasAccess(actor);
  const current = await cards.get(id);
  if (!current || current.generation !== generation) return false;
  if (change.kind === "geometry") {
    assertElementGeometry(change.geometry);
    if (current.removed) return false;
    await cards.geometry(id, change.geometry);
  } else {
    const removed = change.kind === "remove";
    if (removed === current.removed) return false;
    await cards.lifecycle(id, removed, current.generation + 1);
  }
  return true;
}
