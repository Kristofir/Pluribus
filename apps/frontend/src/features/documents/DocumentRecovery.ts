import { createStore } from "zustand/vanilla";
export type RecoveryCopy = { json: string; text: string; version: number };
type Entry = RecoveryCopy & { detached: boolean };
/** Only unacknowledged local work is copied; this is never an editable mirror of shared text. */
export function createDocumentRecovery() {
  return createStore<{
    entries: ReadonlyMap<string, Entry>;
    capture: (scope: string, copy: RecoveryCopy | null) => void;
    detach: (scope: string) => void;
    discard: (scope: string) => void;
  }>((set, get) => ({
    entries: new Map(),
    capture(scope, copy) {
      const entries = new Map(get().entries);
      // An old editor's acknowledgement must never erase detached recovery.
      if (entries.get(scope)?.detached) return;
      if (copy) entries.set(scope, { ...copy, detached: false });
      else entries.delete(scope);
      set({ entries });
    },
    detach(scope) {
      const entry = get().entries.get(scope);
      if (entry)
        set({
          entries: new Map(get().entries).set(scope, {
            ...entry,
            detached: true,
          }),
        });
    },
    discard(scope) {
      const entries = new Map(get().entries);
      entries.delete(scope);
      set({ entries });
    },
  }));
}
