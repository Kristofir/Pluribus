import type { GestureAck } from "@pluribus/core/canvas/history";
import { historyLimits } from "@pluribus/core/canvas/history";
import type { GeometryBatch, GeometryUpdate } from "./HistoryTransport";

/** Coalesce user intent; cancellation drops unsent work and closes only submitted geometry. */
export function createGeometryGesture(deps: {
  action: string;
  targets: GeometryUpdate[];
  send(batch: GeometryBatch): Promise<GestureAck>;
  close(sequence: number, uncertain?: GeometryBatch): Promise<boolean>;
  heartbeat(): Promise<boolean>;
  preview(updates: GeometryUpdate[], active: boolean): void;
  finished(): void;
  discard?(): void;
}) {
  let active = true,
    finished = false,
    sending = false,
    queued = false;
  let updates = deps.targets.map((u) => ({
    ...u,
    geometry: { ...u.geometry },
  }));
  let settled = false;
  let sequence = 0,
    lastSentAt = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let heartbeatSending = false;
  function stop() {
    clearTimeout(timer);
    clearInterval(heartbeat);
  }
  async function close(uncertain?: GeometryBatch) {
    if (finished) return;
    finished = true;
    active = false;
    stop();
    try {
      await deps.close(sequence, uncertain);
    } finally {
      settled = true;
      deps.finished();
    }
  }
  function schedule() {
    if (finished || sending) return;
    if (!queued) {
      if (!active) void close();
      return;
    }
    const delay = active ? Math.max(0, 50 - (Date.now() - lastSentAt)) : 0;
    clearTimeout(timer);
    if (delay) timer = setTimeout(() => void flush(), delay);
    else void flush();
  }
  async function flush() {
    if (finished || sending) return;
    sending = true;
    queued = false;
    lastSentAt = Date.now();
    const batch: GeometryBatch = {
      action: deps.action,
      sequence: sequence + 1,
      updates: updates.map((u) => ({ ...u, geometry: { ...u.geometry } })),
    };
    try {
      const ack = await deps.send(batch);
      sequence = ack.sequence;
      if (ack.status !== "accepted") {
        active = false;
        queued = false;
      }
      sending = false;
      schedule();
    } catch {
      // Retry the exact update first, then send a distinct close request.
      active = false;
      queued = false;
      sending = false;
      await close(batch);
    }
  }
  function cancel() {
    if (finished) return;
    deps.discard?.();
    active = false;
    queued = false;
    stop();
    if (!sending) void close();
  }
  heartbeat = setInterval(() => {
    if (!active || finished || heartbeatSending || sequence === 0) return;
    heartbeatSending = true;
    void deps
      .heartbeat()
      .then((open) => {
        if (!open) cancel();
      })
      .catch(() => {})
      .finally(() => {
        heartbeatSending = false;
      });
  }, historyLimits.heartbeatMs);
  return {
    get settled() {
      return settled;
    },
    get active() {
      return active && !finished;
    },
    update(changes: GeometryUpdate[]) {
      if (!active || finished) return;
      const byId = new Map(changes.map((u) => [u.id, u]));
      updates = updates.map((u) => byId.get(u.id) ?? u);
      queued = true;
      deps.preview(updates, true);
      schedule();
    },
    end() {
      if (!active || finished) return;
      active = false;
      clearInterval(heartbeat);
      deps.preview(updates, false);
      schedule();
    },
    cancel,
  };
}
