import { sourceLimits } from "../../sources/domain/Source";
import { documentLimits } from "../domain/Document";
import { imageLimits } from "../domain/Image";
import { assertCanvasAccess, type CanvasActor } from "../domain/Access";
import type { CanvasElement, ElementId } from "../domain/Element";
import { rectangleLimits } from "../domain/Rectangle";

/** Lifecycle storage shared by supported Element types within one transaction. */
export interface ElementLifecycles {
  get(
    id: ElementId,
  ): Promise<Pick<CanvasElement, "kind" | "generation" | "removed"> | null>;
  lifecycle(id: ElementId, removed: boolean, generation: number): Promise<void>;
  count(kind: CanvasElement["kind"]): Promise<number>;
}

/** Evidence for one accepted deletion; saved content remains owned by the Element. */
export interface ElementDeletion {
  operation: string;
  element: ElementId;
  generation: number;
  owner: string | null;
  proof: string;
  restoredGeneration?: number;
}
export interface DeletionReceipts {
  find(operation: string): Promise<ElementDeletion | null>;
  record(receipt: ElementDeletion): Promise<void>;
  restore(operation: string, generation: number): Promise<void>;
}
const restoreCapacity: Record<CanvasElement["kind"], number> = {
  image: imageLimits.maxCount,
  source: sourceLimits.maxCount,
  rectangle: rectangleLimits.maxCount,
  document: documentLimits.maxCount,
};
type Dependencies = { elements: ElementLifecycles; receipts: DeletionReceipts };
type Actor = { access: CanvasActor; owner: string | null };
type Credential = { operation: string; proof: string };
export type DeletionResult = {
  status: "deleted" | "restored" | "conflict" | "full";
  generation: number;
};
function authorize(receipt: ElementDeletion, actor: Actor, proof: string) {
  if (receipt.owner !== actor.owner || receipt.proof !== proof)
    throw new Error("Deletion history belongs to another editing session");
}

/** One transaction commits the lifecycle and receipt; retries never delete a later incarnation. */
export async function deleteCanvasElement(
  { elements, receipts }: Dependencies,
  actor: Actor,
  command: Credential & { element: ElementId; generation: number },
): Promise<DeletionResult> {
  assertCanvasAccess(actor.access);
  const receipt = await receipts.find(command.operation);
  const element = await elements.get(command.element);
  if (receipt) {
    authorize(receipt, actor, command.proof);
    if (
      receipt.element !== command.element ||
      receipt.generation !== command.generation + 1
    )
      throw new Error("Deletion request identity was reused");
    return {
      status:
        element?.removed &&
        element.generation === receipt.generation &&
        receipt.restoredGeneration === undefined
          ? "deleted"
          : "conflict",
      generation: element?.generation ?? 0,
    };
  }
  if (!element || element.removed || element.generation !== command.generation)
    return { status: "conflict", generation: element?.generation ?? 0 };
  const generation = element.generation + 1;
  await elements.lifecycle(command.element, true, generation);
  await receipts.record({ ...command, generation, owner: actor.owner });
  return { status: "deleted", generation };
}

/** Restore canonical content with a fresh generation, never old editor sessions or pending steps. */
export async function undoElementDeletion(
  { elements, receipts }: Dependencies,
  actor: Actor,
  command: Credential,
): Promise<DeletionResult> {
  assertCanvasAccess(actor.access);
  const receipt = await receipts.find(command.operation);
  if (!receipt) return { status: "conflict", generation: 0 };
  authorize(receipt, actor, command.proof);
  const element = await elements.get(receipt.element);
  if (receipt.restoredGeneration !== undefined)
    return {
      status:
        element &&
        !element.removed &&
        element.generation === receipt.restoredGeneration
          ? "restored"
          : "conflict",
      generation: element?.generation ?? 0,
    };
  if (!element || !element.removed || element.generation !== receipt.generation)
    return { status: "conflict", generation: element?.generation ?? 0 };
  if ((await elements.count(element.kind)) >= restoreCapacity[element.kind])
    return { status: "full", generation: element.generation };
  const generation = element.generation + 1;
  await elements.lifecycle(receipt.element, false, generation);
  await receipts.restore(receipt.operation, generation);
  return { status: "restored", generation };
}
