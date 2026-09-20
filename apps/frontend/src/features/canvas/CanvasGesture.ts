import type { createElementHistory } from "./ElementHistory";
import type { GeometryUpdate } from "./HistoryTransport";

/** Translate React Flow change batches into a single user gesture handle. */
export function createCanvasGesture(
  history: ReturnType<typeof createElementHistory>,
) {
  let handle: ReturnType<typeof history.beginGesture> = null;
  let ids = new Set<string>();
  return {
    get active() {
      return handle?.active ?? false;
    },
    get busy() {
      return handle !== null && !handle.settled;
    },
    has(id: string) {
      return ids.has(id) && handle !== null && !handle.settled;
    },
    start(targets: GeometryUpdate[]) {
      const next = history.beginGesture(targets);
      if (!next) return false;
      handle = next;
      ids = new Set(targets.map((t) => t.id));
      return true;
    },
    stage(updates: GeometryUpdate[], active: boolean) {
      if (updates.length) handle?.update(updates);
      if (!active) handle?.end();
    },
    interrupt() {
      handle?.cancel();
    },
    dispose() {
      handle?.cancel();
      handle = null;
      ids.clear();
    },
  };
}
