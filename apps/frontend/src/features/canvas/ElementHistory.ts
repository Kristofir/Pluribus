import { executeHistoryAction } from "./HistoryActions";
import { terminalHistoryError } from "./HistoryErrors";
import { createHistory } from "./History";
import { createGeometryGesture } from "./GeometryGesture";
import type {
  ActionEntry,
  ActionInput,
  GeometryUpdate,
  HistoryTransport,
} from "./HistoryTransport";

/** Compact user-action facade; protocol identities and gesture recovery remain private. */
export function createElementHistory(
  transport: HistoryTransport,
  effects: {
    guardRemoval?(ids: string[]): string | null;
    preview?(updates: GeometryUpdate[], active: boolean): void;
    clear?(ids: string[]): void;
    pending?(value: boolean): void;
  } = {},
) {
  const registration = { nonce: transport.token(), secret: transport.token() };
  let session:
    | Promise<{
        session: Awaited<ReturnType<HistoryTransport["open"]>>;
        secret: string;
      }>
    | undefined;
  const auth = () =>
    (session ??= transport
      .open(registration)
      .then((id) => ({ session: id, secret: registration.secret }))
      .catch((error) => {
        session = undefined;
        throw error;
      }));
  let gesture: ReturnType<typeof createGeometryGesture> | null = null;
  let mounted = true;
  let gestureAction: string | null = null;
  const history = createHistory<ActionEntry>({
    rejection: terminalHistoryError,
    canExecute(command, action) {
      if (!mounted) return "Canvas session ended.";
      if (
        gesture &&
        !(
          action === "apply" &&
          command.kind === "geometry" &&
          command.action === gestureAction
        )
      )
        return "Finish the gesture first.";
      const removes =
        (command.kind === "delete" && action !== "undo") ||
        (command.kind === "create" && action === "undo");
      return removes && command.id
        ? (effects.guardRemoval?.([command.id]) ?? null)
        : null;
    },
    prepare: (command) => ({ ...command, attempt: transport.token() }),
    async execute(command, direction) {
      const credentials = await auth();
      const result = await executeHistoryAction(
        transport,
        credentials,
        command,
        direction,
      );
      if (!mounted)
        return { status: "blocked", message: "Canvas session ended." };
      if (result.status === "noop") return { status: "unchanged" };
      if (result.status !== "applied")
        return {
          status: result.status === "reconcile" ? "blocked" : result.status,
          message:
            result.message ?? "This history action is no longer available.",
        };
      const saved: ActionEntry =
        command.kind === "geometry"
          ? {
              kind: "geometry",
              action: command.action,
              attempt: command.attempt,
              revision: result.revision,
              sequence: result.sequence,
            }
          : {
              ...command,
              revision: result.revision,
              ...(result.id ? { id: result.id } : {}),
            };
      return { status: "applied", command: saved };
    },
  });
  return {
    store: history.store,
    perform(input: ActionInput) {
      const base = { action: transport.token(), attempt: "", revision: 0 };
      return history.apply(
        input.kind === "create"
          ? { ...base, kind: "create", input }
          : { ...base, kind: "delete", input, id: input.id },
      );
    },
    undo: history.undo,
    redo: history.redo,
    retry: () => history.store.getState().retry?.() ?? Promise.resolve(false),
    beginGesture(targets: GeometryUpdate[]) {
      if (
        !mounted ||
        gesture ||
        !targets.length ||
        history.store.getState().busy ||
        history.store.getState().retry
      )
        return null;
      const action = transport.token();
      gestureAction = action;
      effects.pending?.(true);
      const current = createGeometryGesture({
        action,
        targets,
        send: async (batch) =>
          transport.update({ ...(await auth()), ...batch }),
        heartbeat: async () =>
          transport.heartbeat({ ...(await auth()), action }),
        async close(sequence, pendingUpdate) {
          const command: ActionEntry = {
            kind: "geometry",
            action,
            revision: 0,
            attempt: transport.token(),
            sequence,
            ...(pendingUpdate ? { pendingUpdate } : {}),
          };
          if (mounted) return history.apply(command);
          // Teardown may finish an in-flight batch; close its old session without updating UI.
          try {
            await executeHistoryAction(
              transport,
              await auth(),
              command,
              "apply",
            );
          } catch {
            /* The idle checker covers disappearance or failed best-effort close. */
          }
          return false;
        },
        discard: () => {
          if (mounted) effects.clear?.(targets.map((t) => t.id));
        },
        preview: (updates, active) => {
          if (mounted) effects.preview?.(updates, active);
        },
        finished() {
          if (gesture !== current) return;
          gesture = null;
          gestureAction = null;
          if (mounted) {
            effects.pending?.(false);
            effects.clear?.(targets.map((t) => t.id));
          }
        },
      });
      gesture = current;
      return current;
    },
    /** React lifecycle adapter: idle server closure covers a hard disappearance. */
    mount() {
      mounted = true;
    },
    dispose() {
      gesture?.cancel();
      mounted = false;
    },
  };
}
