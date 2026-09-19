import { assertCanvasAccess, type CanvasActor } from "../domain/Access";
import type { DocumentElementId } from "../domain/Element";
import type { CanvasDocuments } from "./Documents";

/** Evidence for one accepted deletion; saved text remains owned by the child. */
export interface DocumentDeletion {
  operation: string;
  element: DocumentElementId;
  generation: number;
  owner: string | null;
  proof: string;
  restoredGeneration?: number;
}
export interface DeletionReceipts {
  find(operation: string): Promise<DocumentDeletion | null>;
  record(receipt: DocumentDeletion): Promise<void>;
  restore(operation: string, generation: number): Promise<void>;
}
type Dependencies = { cards: CanvasDocuments; receipts: DeletionReceipts };
type Actor = { access: CanvasActor; owner: string | null };
type Credential = { operation: string; proof: string };
export type DeletionResult = {
  status: "deleted" | "restored" | "conflict" | "full";
  generation: number;
};
function authorize(receipt: DocumentDeletion, actor: Actor, proof: string) {
  if (receipt.owner !== actor.owner || receipt.proof !== proof)
    throw new Error("Deletion history belongs to another editing session");
}

/** One transaction commits the lifecycle and receipt; retries never delete a later incarnation. */
export async function deleteCanvasDocument(
  { cards, receipts }: Dependencies,
  actor: Actor,
  command: Credential & { element: DocumentElementId; generation: number },
): Promise<DeletionResult> {
  assertCanvasAccess(actor.access);
  const receipt = await receipts.find(command.operation);
  const child = await cards.get(command.element);
  if (receipt) {
    authorize(receipt, actor, command.proof);
    if (
      receipt.element !== command.element ||
      receipt.generation !== command.generation + 1
    )
      throw new Error("Deletion request identity was reused");
    return {
      status:
        child?.removed &&
        child.generation === receipt.generation &&
        receipt.restoredGeneration === undefined
          ? "deleted"
          : "conflict",
      generation: child?.generation ?? 0,
    };
  }
  if (!child || child.removed || child.generation !== command.generation)
    return { status: "conflict", generation: child?.generation ?? 0 };
  const generation = child.generation + 1;
  await cards.lifecycle(command.element, true, generation);
  await receipts.record({ ...command, generation, owner: actor.owner });
  return { status: "deleted", generation };
}

/** Restore canonical content with a fresh generation, never old editor sessions or pending steps. */
export async function undoDocumentDeletion(
  { cards, receipts }: Dependencies,
  actor: Actor,
  command: Credential,
): Promise<DeletionResult> {
  assertCanvasAccess(actor.access);
  const receipt = await receipts.find(command.operation);
  if (!receipt) return { status: "conflict", generation: 0 };
  authorize(receipt, actor, command.proof);
  const child = await cards.get(receipt.element);
  if (receipt.restoredGeneration !== undefined)
    return {
      status:
        child &&
        !child.removed &&
        child.generation === receipt.restoredGeneration
          ? "restored"
          : "conflict",
      generation: child?.generation ?? 0,
    };
  if (!child || !child.removed || child.generation !== receipt.generation)
    return { status: "conflict", generation: child?.generation ?? 0 };
  if ((await cards.count()) >= 2)
    return { status: "full", generation: child.generation };
  const generation = child.generation + 1;
  await cards.lifecycle(receipt.element, false, generation);
  await receipts.restore(receipt.operation, generation);
  return { status: "restored", generation };
}
