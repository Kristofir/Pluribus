import { createStore } from "zustand/vanilla";
import type { Id } from "@pluribus/backend/dataModel";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@pluribus/backend/api";
type Delete = FunctionArgs<typeof api.Canvas.deleteDocument>;
type Result = FunctionReturnType<typeof api.Canvas.deleteDocument>;
type Entry = Delete;
type State = {
  undo: readonly Entry[];
  redo: readonly Entry[];
  busy: boolean;
  error: string | null;
  retry: (() => Promise<boolean>) | null;
};

/** Personal command history only. Convex owns the scene and the saved restoration data. */
export function createDocumentHistory(transport: {
  remove: (args: Delete) => Promise<Result>;
  restore: (args: Pick<Delete, "operation" | "secret">) => Promise<Result>;
  token: () => string;
}) {
  const store = createStore<State>(() => ({
    undo: [],
    redo: [],
    busy: false,
    error: null,
    retry: null,
  }));
  async function execute(
    kind: "delete" | "undo" | "redo",
    entry: Entry,
  ): Promise<boolean> {
    if (store.getState().busy) return false;
    store.setState({ busy: true, error: null, retry: null });
    try {
      const result =
        kind === "undo"
          ? await transport.restore({
              operation: entry.operation,
              secret: entry.secret,
            })
          : await transport.remove(entry);
      if (result.status === "full") {
        store.setState({
          error:
            "The canvas holds two active documents. Delete one, then try Undo again.",
        });
        return false;
      }
      if (result.status !== (kind === "undo" ? "restored" : "deleted")) {
        // Retire only this stale command, never reinterpret it against a newer generation.
        if (kind === "undo")
          store.setState({ undo: store.getState().undo.slice(0, -1) });
        if (kind === "redo")
          store.setState({ redo: store.getState().redo.slice(0, -1) });
        store.setState({
          error:
            "This document changed lifecycle in another session. That history action is no longer available.",
        });
        return false;
      }
      const { undo, redo } = store.getState();
      if (kind === "undo") {
        store.setState({
          undo: undo.slice(0, -1),
          redo: [...redo, { ...entry, generation: result.generation }],
        });
      } else {
        store.setState({
          undo: [...undo, entry],
          redo: kind === "delete" ? [] : redo.slice(0, -1),
        });
      }
      return true;
    } catch {
      // A lost response may already have committed. Keep the exact command for retry.
      store.setState({
        error:
          "Could not confirm the document action. Retry to check its result.",
        retry: () => execute(kind, entry),
      });
      return false;
    } finally {
      store.setState({ busy: false });
    }
  }
  return {
    store,
    remove(id: Id<"canvasDocuments">, generation: number) {
      if (store.getState().retry) return Promise.resolve(false);
      return execute("delete", {
        id,
        generation,
        operation: transport.token(),
        secret: transport.token(),
      });
    },
    undo() {
      const state = store.getState(),
        entry = state.undo.at(-1);
      return entry && !state.retry
        ? execute("undo", entry)
        : Promise.resolve(false);
    },
    redo() {
      const state = store.getState(),
        entry = state.redo.at(-1);
      // Redo is a new deletion of the restored incarnation, preserving its current saved contents.
      return entry && !state.retry
        ? execute("redo", {
            ...entry,
            operation: transport.token(),
            secret: transport.token(),
          })
        : Promise.resolve(false);
    },
  };
}
