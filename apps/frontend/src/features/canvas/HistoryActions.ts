import type { HistoryAction } from "./History";
import type {
  ActionEntry,
  ActionOutcome,
  HistoryTransport,
} from "./HistoryTransport";
import { terminalHistoryError } from "./HistoryErrors";

/** Typed action transport; known reconciliation advances attempts, unknown outcomes reuse them. */
export async function executeHistoryAction(
  transport: HistoryTransport,
  credentials: {
    session: Awaited<ReturnType<HistoryTransport["open"]>>;
    secret: string;
  },
  command: ActionEntry,
  direction: HistoryAction,
): Promise<ActionOutcome> {
  let result: ActionOutcome;
  if (direction !== "apply") {
    result = await transport.reverse({
      ...credentials,
      action: command.action,
      attempt: command.attempt,
      revision: command.revision,
      undo: direction === "undo",
    });
  } else if (command.kind !== "geometry") {
    result = await transport.apply({
      ...credentials,
      action: command.action,
      attempt: command.attempt,
      input: command.input,
    });
  } else {
    if (command.pendingUpdate) {
      try {
        const ack = await transport.update({
          ...credentials,
          ...command.pendingUpdate,
        });
        command.sequence = ack.sequence;
        command.pendingUpdate = undefined;
      } catch (error) {
        if (!terminalHistoryError(error)) throw error;
        // A rejected batch has no new writes. Close the previously accepted cursor.
        command.pendingUpdate = undefined;
      }
    }
    if (command.sequence === 0)
      return {
        status: "noop",
        action: command.action,
        revision: 0,
        sequence: 0,
        id: null,
        message: null,
      };
    command.closeRequest ??= {
      attempt: command.attempt,
      sequence: command.sequence,
    };
    result = await transport.close({
      ...credentials,
      action: command.action,
      ...command.closeRequest,
    });
    if (result.status === "reconcile") {
      command.sequence = result.sequence;
      command.closeRequest = {
        attempt: transport.token(),
        sequence: result.sequence,
      };
      result = await transport.close({
        ...credentials,
        action: command.action,
        ...command.closeRequest,
      });
    }
  }
  return result;
}
