import { createStore } from "zustand/vanilla";
import type { Geometry } from "@pluribus/core/canvas/domain";

type Gesture = {
  token: object;
  geometry: Geometry;
  active: boolean;
  queued: boolean;
  sending: boolean;
  lastSentAt: number;
};
export type CanvasState<Id extends string> = {
  editing: string | null;
  setEditing: (id: string | null) => void;
  enabled: boolean;
  gestures: ReadonlyMap<Id, Gesture>;
  selected: ReadonlySet<string>;
  removing: ReadonlySet<Id>;
  creating: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => void;
  stage: (id: Id, geometry: Geometry, active: boolean) => void;
  cancel: (id: Id) => void;
  retain: (ids: ReadonlySet<Id>) => void;
  select: (changes: { id: string; selected: boolean }[]) => void;
  selectOnly: (id: Id) => void;
  beginCreate: () => boolean;
  finishCreate: (error?: string) => void;
  beginRemove: (ids: Id[]) => void;
  finishRemove: (ids: Id[], error?: string) => void;
};

/** One store per mounted canvas. Only transient interaction state lives here;
 * the Convex query remains the sole owner of the shared scene. */
export function createCanvasStore<Id extends string>(
  send: (id: Id, geometry: Geometry) => Promise<boolean>,
) {
  // Timer handles are adapter resources, not scene data. Each belongs to one store.
  const timers = new Map<Id, ReturnType<typeof setTimeout>>();
  const store = createStore<CanvasState<Id>>((set, get) => ({
    editing: null,
    setEditing: (editing) => set({ editing }),
    enabled: false,
    gestures: new Map(),
    selected: new Set(),
    removing: new Set(),
    creating: false,
    error: null,
    setEnabled: (enabled) => {
      if (!enabled) {
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        set({ enabled, gestures: new Map() });
      } else set({ enabled });
    },
    stage: (id, geometry, active) => {
      if (!get().enabled || get().removing.has(id)) return;
      const existing = get().gestures.get(id);
      const gesture: Gesture = {
        token: existing?.token ?? {},
        lastSentAt: existing?.lastSentAt ?? -Infinity,
        sending: existing?.sending ?? false,
        geometry,
        active,
        queued: true,
      };
      set({ gestures: new Map(get().gestures).set(id, gesture), error: null });
      schedule(id);
    },
    cancel: (id) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
      if (!get().gestures.has(id)) return;
      const gestures = new Map(get().gestures);
      gestures.delete(id);
      set({ gestures });
    },
    retain: (ids) => {
      for (const id of get().gestures.keys())
        if (!ids.has(id)) get().cancel(id);
      const valid = new Set<string>(ids);
      const selected = new Set(
        [...get().selected].filter((id) => valid.has(id)),
      );
      if (selected.size !== get().selected.size) set({ selected });
    },
    select: (changes) => {
      const selected = new Set(get().selected);
      for (const change of changes) {
        if (change.selected) selected.add(change.id);
        else selected.delete(change.id);
      }
      if (
        selected.size !== get().selected.size ||
        [...selected].some((id) => !get().selected.has(id))
      )
        set({ selected });
    },
    selectOnly: (id) => set({ selected: new Set([id]) }),
    beginCreate: () => {
      if (!get().enabled || get().creating) return false;
      set({ creating: true, error: null });
      return true;
    },
    finishCreate: (error) => set({ creating: false, error: error ?? null }),
    beginRemove: (ids) => {
      for (const id of ids) get().cancel(id);
      set({ removing: new Set([...get().removing, ...ids]), error: null });
    },
    finishRemove: (ids, error) => {
      const completed = new Set(ids);
      set({
        removing: new Set(
          [...get().removing].filter((id) => !completed.has(id)),
        ),
        error: error ?? null,
      });
    },
  }));

  function schedule(id: Id) {
    const gesture = store.getState().gestures.get(id);
    if (!gesture || gesture.sending || !gesture.queued) return;
    clearTimeout(timers.get(id));
    timers.delete(id);
    const delay = gesture.active
      ? Math.max(0, 50 - (Date.now() - gesture.lastSentAt))
      : 0;
    if (delay === 0) void flush(id);
    else
      timers.set(
        id,
        setTimeout(() => void flush(id), delay),
      );
  }

  async function flush(id: Id) {
    const { gestures, enabled } = store.getState();
    const gesture = gestures.get(id);
    if (!enabled || !gesture || gesture.sending || !gesture.queued) return;
    timers.delete(id);
    store.setState({
      gestures: new Map(gestures).set(id, {
        ...gesture,
        queued: false,
        sending: true,
        lastSentAt: Date.now(),
      }),
    });
    try {
      const exists = await send(id, gesture.geometry);
      const current = store.getState().gestures.get(id);
      // Deletion, disconnect, or a new gesture invalidates this completion.
      if (!current || current.token !== gesture.token) return;
      if (!exists || (!current.active && !current.queued))
        store.getState().cancel(id);
      else {
        store.setState({
          gestures: new Map(store.getState().gestures).set(id, {
            ...current,
            sending: false,
          }),
        });
        schedule(id);
      }
    } catch {
      if (store.getState().gestures.get(id)?.token !== gesture.token) return;
      store.getState().cancel(id);
      store.setState({
        error:
          "A movement could not be saved. The canvas has returned to shared state.",
      });
    }
  }
  return store;
}
