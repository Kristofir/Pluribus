import { createStore } from "zustand/vanilla";

export type HistoryAction = "apply" | "undo" | "redo";
export type HistoryResult<Command> =
  | { status: "applied"; command: Command }
  | { status: "blocked" | "obsolete" | "rejected"; message: string }
  | { status: "unchanged" };

type State<Command> = {
  undo: readonly Command[];
  redo: readonly Command[];
  busy: boolean;
  error: string | null;
  retry: (() => Promise<boolean>) | null;
};

/** Own ordering and retries; operation handlers own commands, inverses and conflicts. */
export function createHistory<Command>(handler: {
  canExecute?(command: Command, action: HistoryAction): string | null;
  rejection?(error: unknown): string | null;
  prepare(command: Command, action: HistoryAction): Command;
  execute(
    command: Command,
    action: HistoryAction,
  ): Promise<HistoryResult<Command>>;
}) {
  const store = createStore<State<Command>>(() => ({
    undo: [],
    redo: [],
    busy: false,
    error: null,
    retry: null,
  }));
  async function execute(
    command: Command,
    action: HistoryAction,
  ): Promise<boolean> {
    if (store.getState().busy) return false;
    const blocked = handler.canExecute?.(command, action);
    if (blocked) {
      store.setState({ error: blocked });
      return false;
    }
    store.setState({ busy: true, error: null, retry: null });
    try {
      const result = await handler.execute(command, action);
      if (result.status === "unchanged") return true;
      if (result.status !== "applied") {
        if (result.status === "obsolete" && action !== "apply")
          store.setState({ [action]: store.getState()[action].slice(0, -1) });
        store.setState({ error: result.message });
        return false;
      }
      const { undo, redo } = store.getState();
      store.setState(
        action === "undo"
          ? { undo: undo.slice(0, -1), redo: [...redo, result.command] }
          : {
              undo: [...undo, result.command],
              redo: action === "apply" ? [] : redo.slice(0, -1),
            },
      );
      return true;
    } catch (error) {
      const rejection = handler.rejection?.(error);
      if (rejection) {
        store.setState({ error: rejection, retry: null });
        return false;
      }
      // Preparation runs once: an ambiguous response must retry the same request.
      store.setState({
        error: "Could not confirm the action. Retry to check its result.",
        retry: () => execute(command, action),
      });
      return false;
    } finally {
      store.setState({ busy: false });
    }
  }
  function start(command: Command, action: HistoryAction) {
    const state = store.getState();
    if (state.busy || state.retry) return Promise.resolve(false);
    return execute(handler.prepare(command, action), action);
  }
  return {
    store,
    apply: (command: Command) => start(command, "apply"),
    undo() {
      const entry = store.getState().undo.at(-1);
      return entry !== undefined
        ? start(entry, "undo")
        : Promise.resolve(false);
    },
    redo() {
      const entry = store.getState().redo.at(-1);
      return entry !== undefined
        ? start(entry, "redo")
        : Promise.resolve(false);
    },
  };
}
