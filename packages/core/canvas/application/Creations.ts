import { sourceLimits } from "../../sources/domain/Source";
import { documentLimits } from "../domain/Document";
import { imageLimits } from "../domain/Image";
import { assertCanvasAccess, type CanvasActor } from "../domain/Access";
import { rectangleLimits } from "../domain/Rectangle";
import type { CanvasElement, ElementId } from "../domain/Element";
import type { ElementLifecycles } from "./Deletions";

/** Accepted creation identity; retries recover the original Element, never a copy. */
export interface ElementCreation {
  operation: string;
  owner: string | null;
  proof: string;
  request: string;
  element: ElementId;
}

/** Commit creation and evidence together through transaction-bound adapters. */
export async function createRecordedElement(
  dependencies: {
    kind: CanvasElement["kind"];
    elements: ElementLifecycles;
    find(operation: string): Promise<ElementCreation | null>;
    record(receipt: ElementCreation): Promise<void>;
    create(): Promise<ElementId>;
  },
  actor: { access: CanvasActor; owner: string | null },
  command: { operation: string; proof: string; request: string },
) {
  assertCanvasAccess(actor.access);
  const receipt = await dependencies.find(command.operation);
  if (receipt) {
    if (receipt.owner !== actor.owner || receipt.proof !== command.proof)
      throw new Error("Creation history belongs to another editing session");
    if (receipt.request !== command.request)
      throw new Error("Creation request identity was reused");
    const element = await dependencies.elements.get(receipt.element);
    return {
      status:
        element && !element.removed && element.generation === 1
          ? ("created" as const)
          : ("conflict" as const),
      id: receipt.element,
      generation: 1,
    };
  }
  const capacity =
    dependencies.kind === "rectangle"
      ? rectangleLimits.maxCount
      : dependencies.kind === "image"
        ? imageLimits.maxCount
        : dependencies.kind === "source"
          ? sourceLimits.maxCount
          : documentLimits.maxCount;
  if ((await dependencies.elements.count(dependencies.kind)) >= capacity)
    return { status: "full" as const, id: null, generation: 0 };
  const element = await dependencies.create();
  await dependencies.record({ ...command, owner: actor.owner, element });
  return { status: "created" as const, id: element, generation: 1 };
}
