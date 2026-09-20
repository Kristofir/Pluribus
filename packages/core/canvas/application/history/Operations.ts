import type { CanvasActionInput, HistoryOutcome } from "../../domain/History";
import type { HistoryPorts } from "./Ports";
import { applyLifecycle, reverseLifecycle } from "./Lifecycle";
import { reverseGeometry, sealGesture } from "./Geometry";
import { outcome } from "./Results";
export type DurableHistoryCommand =
  | { kind: "apply"; input: CanvasActionInput }
  | { kind: "reverse"; undo: boolean; revision: number }
  | { kind: "close"; sequence: number };

/** Attempt outcomes are immutable. Current reversibility is checked only for a NEW attempt. */
export async function executeHistoryAttempt(
  ports: HistoryPorts,
  args: {
    action: string;
    attempt: string;
    fingerprint: string;
    deletion: string;
    command: DurableHistoryCommand;
  },
): Promise<HistoryOutcome> {
  const old = await ports.attempts.get(args.attempt);
  if (old)
    return old.fingerprint === args.fingerprint
      ? old.outcome
      : outcome(args.action, "rejected", "Attempt identity was reused.");
  const { command, action } = args;
  const record = await ports.actions.get(action);
  let result: HistoryOutcome;
  if (command.kind === "apply") {
    result = record
      ? outcome(action, "rejected", "Action identity already exists.")
      : await applyLifecycle(ports, action, command.input, args.deletion);
  } else if (command.kind === "close") {
    if (!record)
      result = outcome(action, "rejected", "Unknown gesture action.");
    else if (record.payload.kind !== "geometry")
      result = outcome(action, "rejected", "Not a geometry action.");
    else if (record.payload.sequence !== command.sequence)
      result = {
        ...outcome(action, "reconcile", "Gesture sequence changed."),
        sequence: record.payload.sequence,
        revision: record.revision,
      };
    else result = await sealGesture(ports, record);
  } else if (
    !record ||
    record.revision !== command.revision ||
    record.state !== (command.undo ? "applied" : "undone")
  ) {
    result = outcome(
      action,
      "obsolete",
      "The action no longer matches this History entry.",
    );
  } else {
    result =
      record.payload.kind === "geometry"
        ? await reverseGeometry(ports, record, command.undo)
        : await reverseLifecycle(
            ports,
            record,
            record.payload,
            command.undo,
            args.deletion,
          );
  }
  await ports.attempts.save(args.attempt, args.fingerprint, result);
  return result;
}
