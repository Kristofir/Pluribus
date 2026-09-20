import { assertCanvasAccess, type CanvasActor } from "../domain/Access";
import type { CanvasElement, ElementId } from "../domain/Element";
import {
  assertDocumentGeometry,
  assertElementGeometry,
  type Geometry,
} from "../domain/Geometry";

export type GeometryUpdate = {
  id: ElementId;
  generation: number;
  geometry: Geometry;
};
type Change = {
  id: ElementId;
  generation: number;
  before: Geometry;
  after: Geometry;
};
export interface GeometryReceipt {
  operation: string;
  owner: string | null;
  proof: string;
  sequence: number;
  revision: number;
  closed: boolean;
  undone: boolean;
  changes: Change[];
}
export interface GeometryHistoryPorts {
  elements: {
    get(
      id: ElementId,
    ): Promise<Pick<
      CanvasElement,
      "kind" | "generation" | "removed" | "geometry"
    > | null>;
    write(id: ElementId, geometry: Geometry): Promise<void>;
  };
  receipts: {
    find(operation: string): Promise<GeometryReceipt | null>;
    save(receipt: GeometryReceipt): Promise<void>;
  };
}
type Actor = { access: CanvasActor; owner: string | null };
type Credential = { operation: string; proof: string };
export type GeometryResult = {
  status: "applied" | "conflict" | "unchanged";
  revision: number;
};
export function sameGeometry(a: Geometry, b: Geometry) {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}
function authorize(receipt: GeometryReceipt, actor: Actor, proof: string) {
  if (receipt.owner !== actor.owner || receipt.proof !== proof)
    throw new Error("Geometry history belongs to another editing session");
}
const conflict = (): GeometryResult => ({ status: "conflict", revision: 0 });
function result(receipt: GeometryReceipt): GeometryResult {
  return {
    status: receipt.changes.every((c) => sameGeometry(c.before, c.after))
      ? "unchanged"
      : "applied",
    revision: receipt.revision,
  };
}

/** Coalesce a bounded gesture into one receipt; every accepted batch and its evidence commit together. */
export async function applyGeometryGesture(
  { elements, receipts }: GeometryHistoryPorts,
  actor: Actor,
  command: Credential & {
    sequence: number;
    final: boolean;
    updates: GeometryUpdate[];
  },
): Promise<GeometryResult> {
  assertCanvasAccess(actor.access);
  if (
    !Number.isSafeInteger(command.sequence) ||
    command.sequence < 1 ||
    !command.updates.length ||
    command.updates.length > 202 ||
    new Set(command.updates.map((u) => u.id)).size !== command.updates.length
  )
    throw new Error("Invalid geometry gesture");
  const previous = await receipts.find(command.operation);
  if (previous) authorize(previous, actor, command.proof);
  if (
    previous &&
    (previous.revision !== 0 ||
      command.sequence < previous.sequence ||
      command.sequence > previous.sequence + 1)
  )
    return conflict();
  if (!previous && command.sequence !== 1) return conflict();
  if (
    previous &&
    (previous.changes.length !== command.updates.length ||
      previous.changes.some(
        (c, i) =>
          c.id !== command.updates[i].id ||
          c.generation !== command.updates[i].generation,
      ))
  )
    throw new Error("Geometry request identity was reused");
  const duplicate = previous?.sequence === command.sequence;
  if (previous?.closed && !duplicate) return conflict();
  const changes: Change[] = [];
  // Validate the complete batch before writing any member.
  for (const [i, update] of command.updates.entries()) {
    const element = await elements.get(update.id);
    if (!element || element.removed || element.generation !== update.generation)
      return conflict();
    if (!Number.isSafeInteger(update.generation) || update.generation < 1)
      throw new Error("Invalid generation");
    (element.kind === "document"
      ? assertDocumentGeometry
      : assertElementGeometry)(update.geometry);
    const prior = previous?.changes[i];
    if (prior && !sameGeometry(element.geometry, prior.after))
      return conflict();
    if (duplicate && prior && !sameGeometry(update.geometry, prior.after))
      throw new Error("Geometry request identity was reused");
    changes.push({
      id: update.id,
      generation: update.generation,
      before: prior?.before ?? element.geometry,
      after: update.geometry,
    });
  }
  const receipt: GeometryReceipt = {
    operation: command.operation,
    proof: command.proof,
    sequence: command.sequence,
    owner: actor.owner,
    changes,
    revision: 0,
    undone: false,
    closed: !!previous?.closed || command.final,
  };
  for (const change of changes)
    if (!duplicate) await elements.write(change.id, change.after);
  await receipts.save(receipt);
  return result(receipt);
}

/** Conditional, atomic reversal: a collaborator's later geometry or lifecycle wins over personal Undo. */
export async function reverseGeometryGesture(
  { elements, receipts }: GeometryHistoryPorts,
  actor: Actor,
  command: Credential & { revision: number; undo: boolean },
): Promise<GeometryResult> {
  assertCanvasAccess(actor.access);
  if (!Number.isSafeInteger(command.revision) || command.revision < 0)
    throw new Error("Invalid revision");
  const receipt = await receipts.find(command.operation);
  if (!receipt) return conflict();
  authorize(receipt, actor, command.proof);
  if (!receipt.closed) return conflict();
  const duplicate =
    receipt.revision === command.revision + 1 &&
    receipt.undone === command.undo;
  if (
    !duplicate &&
    (receipt.revision !== command.revision || receipt.undone === command.undo)
  )
    return conflict();
  for (const change of receipt.changes) {
    const element = await elements.get(change.id);
    const expected = receipt.undone ? change.before : change.after;
    if (
      !element ||
      element.removed ||
      element.generation !== change.generation ||
      !sameGeometry(element.geometry, expected)
    )
      return conflict();
  }
  if (duplicate) return result(receipt);
  for (const change of receipt.changes)
    await elements.write(
      change.id,
      command.undo ? change.before : change.after,
    );
  const saved = {
    ...receipt,
    revision: receipt.revision + 1,
    undone: command.undo,
  };
  await receipts.save(saved);
  return result(saved);
}
