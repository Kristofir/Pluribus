// The current single canvas is shared with anonymous and signed-in participants.
// Actor classification comes from the backend auth adapter, never client input.
export type CanvasActor = { kind: "anonymous" } | { kind: "authenticated" };

/**
 * Apply the current shared-canvas policy: anonymous and authenticated participants
 * are both allowed. Future restrictions belong here or in resource-aware core policy,
 * not only in frontend controls. Reject unsupported actors before persistence writes.
 */
export function assertCanvasAccess(actor: CanvasActor): void {
  switch (actor.kind) {
    case "anonymous":
    case "authenticated":
      return;
    default: {
      const unsupported: never = actor;
      throw new Error(`Unsupported canvas actor: ${unsupported}`);
    }
  }
}
