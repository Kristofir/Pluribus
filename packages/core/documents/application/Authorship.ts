import { assertRestoration } from "../domain/Authorship";

export type AuthoredOperation = { id: string; undoOf?: string };
export type MoveEvidence = { group: string; part: "remove" | "insert" };
export type AuthorshipActor = { author: string; session: string };

/** Proof is opaque to application policy; the editor adapter interprets it. */
export type OperationReceipt<Proof> = {
  author: string;
  session: string;
  scope: string;
  consumed: boolean;
  version: number;
  proof: Proof;
  move?: MoveEvidence;
};

export interface AuthorshipEvidence<Proof> {
  find(operation: string): Promise<OperationReceipt<Proof> | null>;
  consume(operation: string, revertedBy: string): Promise<void>;
  record(
    operation: AuthoredOperation,
    receipt: OperationReceipt<Proof>,
  ): Promise<void>;
}

/** One batch-local adapter validates and applies exact submitted edits in order. */
export interface AuthorshipEdits<Proof> {
  apply(
    index: number,
    restoration: OperationReceipt<Proof> | null,
  ): Promise<{
    proof: Proof;
    move?: MoveEvidence;
  }>;
  assertComplete(): void;
}

/**
 * Accept writer evidence and authorized undo as one transaction with text sync.
 * Rejections must escape the caller so earlier receipts and text cannot commit.
 */
export async function acceptAuthoredOperations<Proof>(
  {
    evidence,
    edits,
  }: { evidence: AuthorshipEvidence<Proof>; edits: AuthorshipEdits<Proof> },
  actor: AuthorshipActor,
  scope: string,
  baseVersion: number,
  operations: readonly AuthoredOperation[],
): Promise<void> {
  const restoredMoves = new Map<string, Set<string>>();
  for (const [index, operation] of operations.entries()) {
    if (await evidence.find(operation.id))
      throw new Error("Operation already accepted");
    let restoration: OperationReceipt<Proof> | null = null;
    if (operation.undoOf) {
      restoration = await evidence.find(operation.undoOf);
      if (!restoration) throw new Error("Restoration evidence unavailable");
      assertRestoration(
        actor.author,
        actor.session,
        {
          actor: restoration.author,
          session: restoration.session,
          scope: restoration.scope,
          consumed: restoration.consumed,
        },
        scope,
      );
      if (restoration.move) {
        const { group, part } = restoration.move;
        const parts = restoredMoves.get(group) ?? new Set<string>();
        if (parts.has(part)) throw new Error("Repeated move restoration");
        parts.add(part);
        restoredMoves.set(group, parts);
      }
    }
    const verified = await edits.apply(index, restoration);
    if (operation.undoOf)
      await evidence.consume(operation.undoOf, operation.id);
    await evidence.record(operation, {
      ...actor,
      scope,
      consumed: false,
      version: baseVersion + index + 1,
      proof: verified.proof,
      ...((restoration?.move ?? verified.move)
        ? { move: restoration?.move ?? verified.move }
        : {}),
    });
  }
  if ([...restoredMoves.values()].some((parts) => parts.size !== 2))
    throw new Error("Restore the complete move operation");
  edits.assertComplete();
}
