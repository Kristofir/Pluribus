import { afterEach, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { Id } from "@pluribus/backend/dataModel";
import { createElementHistory } from "./ElementHistory";
import type { HistoryTransport, ActionOutcome } from "./HistoryTransport";
const id = "element" as Id<"canvasDocuments">;
const geometry = { x: 0, y: 0, width: 430, height: 500 };
const creation = {
  kind: "create" as const,
  element: { kind: "document" as const, geometry },
};
const deletion = { kind: "delete" as const, id, generation: 1 };
const outcome = (action: string, revision = 1): ActionOutcome => ({
  action,
  revision,
  status: "applied",
  id,
  sequence: 1,
  message: null,
});
function setup(guardRemoval?: (ids: string[]) => string | null) {
  let token = 0;
  const transport = {
    token: () => String(++token),
    open: vi.fn<HistoryTransport["open"]>(
      async () => "session" as Id<"canvasHistorySessions">,
    ),
    apply: vi.fn<HistoryTransport["apply"]>(async (args) =>
      outcome(args.action),
    ),
    reverse: vi.fn<HistoryTransport["reverse"]>(async (args) =>
      outcome(args.action, args.revision + 1),
    ),
    update: vi.fn<HistoryTransport["update"]>(async (args) => ({
      status: "accepted",
      sequence: args.sequence,
    })),
    close: vi.fn<HistoryTransport["close"]>(async (args) => ({
      ...outcome(args.action),
      sequence: args.sequence,
    })),
    heartbeat: vi.fn<HistoryTransport["heartbeat"]>(async () => true),
  };
  const clear = vi.fn(),
    pending = vi.fn();
  const history = createElementHistory(transport, {
    guardRemoval,
    clear,
    pending,
  });
  return { history, transport, clear, pending };
}
afterEach(() => vi.useRealTimers());

test("creation and deletion share ordering; reversals keep action identity and advance revision", async () => {
  const { history, transport } = setup();
  await history.perform(creation);
  await history.perform(deletion);
  const [create, remove] = history.store.getState().undo;
  await history.undo();
  await history.undo();
  await history.redo();
  await history.redo();
  expect(
    transport.reverse.mock.calls.map(([r]) => [r.action, r.revision, r.undo]),
  ).toEqual([
    [remove.action, 1, true],
    [create.action, 1, true],
    [create.action, 2, false],
    [remove.action, 2, false],
  ]);
  expect(
    new Set(transport.reverse.mock.calls.map(([r]) => r.attempt)).size,
  ).toBe(4);
  expect(transport.open).toHaveBeenCalledTimes(1);
});
test("unknown acknowledgement retains exact attempt and blocks competing actions", async () => {
  const { history, transport } = setup();
  transport.apply.mockRejectedValueOnce(new Error("lost ACK"));
  expect(await history.perform(creation)).toBe(false);
  expect(history.store.getState().undo).toHaveLength(0);
  expect(await history.perform(deletion)).toBe(false);
  expect(history.beginGesture([{ id, generation: 1, geometry }])).toBeNull();
  await history.retry();
  expect(transport.apply.mock.calls[0]).toEqual(transport.apply.mock.calls[1]);
  expect(history.store.getState().undo).toHaveLength(1);
});
test("registration retry retains nonce and secret after ambiguous registration", async () => {
  const { history, transport } = setup();
  transport.open.mockRejectedValueOnce(new Error("lost ACK"));
  await history.perform(creation);
  await history.retry();
  expect(transport.open.mock.calls[0]).toEqual(transport.open.mock.calls[1]);
  expect(history.store.getState().undo).toHaveLength(1);
});
test("terminal validation/auth rejection never traps the stack in network retry", async () => {
  const { history, transport } = setup();
  transport.apply.mockRejectedValueOnce(
    new ConvexError({ code: "HISTORY_REJECTED", message: "Invalid request" }),
  );
  await history.perform(creation);
  expect(history.store.getState()).toMatchObject({
    busy: false,
    retry: null,
    error: "Invalid request",
  });
  await history.perform(creation);
  expect(history.store.getState().undo).toHaveLength(1);
});
test("known capacity block preserves entry and next attempt gets a new identity; obsolete retires", async () => {
  const { history, transport } = setup();
  await history.perform(deletion);
  transport.reverse.mockImplementationOnce(async (args) => ({
    ...outcome(args.action),
    status: "blocked",
  }));
  await history.undo();
  expect(history.store.getState().undo).toHaveLength(1);
  await history.undo();
  expect(history.store.getState().redo).toHaveLength(1);
  expect(transport.reverse.mock.calls[0][0].attempt).not.toBe(
    transport.reverse.mock.calls[1][0].attempt,
  );
  transport.reverse.mockImplementationOnce(async (args) => ({
    ...outcome(args.action),
    status: "obsolete",
  }));
  await history.redo();
  expect(history.store.getState().redo).toHaveLength(0);
});
test("new accepted actions clear Redo; rejected/no-op actions leave it intact", async () => {
  const { history, transport } = setup();
  await history.perform(deletion);
  await history.undo();
  transport.apply.mockImplementationOnce(async (args) => ({
    ...outcome(args.action),
    status: "blocked",
  }));
  await history.perform(creation);
  expect(history.store.getState().redo).toHaveLength(1);
  transport.apply.mockImplementationOnce(async (args) => ({
    ...outcome(args.action),
    status: "noop",
  }));
  await history.perform(creation);
  expect(history.store.getState().redo).toHaveLength(1);
  await history.perform(creation);
  expect(history.store.getState().redo).toHaveLength(0);
});
test("pending local text guards Undo creation and exact removal retries without losing uncertainty", async () => {
  let pending = false;
  const { history, transport } = setup(() => (pending ? "Text pending" : null));
  await history.perform(creation);
  pending = true;
  await history.undo();
  expect(transport.reverse).not.toHaveBeenCalled();
  pending = false;
  transport.reverse.mockRejectedValueOnce(new Error("lost"));
  await history.undo();
  pending = true;
  await history.retry();
  expect(history.store.getState().retry).not.toBeNull();
  expect(transport.reverse).toHaveBeenCalledTimes(1);
  pending = false;
  await history.retry();
  expect(transport.reverse.mock.calls[0]).toEqual(
    transport.reverse.mock.calls[1],
  );
});
test("uncertain gesture update retries exactly before separate close; close retries keep their identity", async () => {
  vi.useFakeTimers();
  const { history, transport, clear } = setup();
  transport.update.mockRejectedValueOnce(new Error("lost ACK"));
  transport.close.mockRejectedValueOnce(new Error("lost close ACK"));
  const gesture = history.beginGesture([{ id, generation: 1, geometry }])!;
  gesture.update([{ id, generation: 1, geometry: { ...geometry, x: 30 } }]);
  await vi.advanceTimersByTimeAsync(0);
  expect(transport.update.mock.calls[0]).toEqual(
    transport.update.mock.calls[1],
  );
  expect(history.store.getState().retry).not.toBeNull();
  await history.retry();
  expect(transport.close.mock.calls[0]).toEqual(transport.close.mock.calls[1]);
  expect(history.store.getState().undo).toHaveLength(1);
  expect(clear).toHaveBeenCalledTimes(1);
});
test("gesture no-op does not clear Redo; auto-close reconciliation records an entry once", async () => {
  vi.useFakeTimers();
  const { history, transport } = setup();
  await history.perform(deletion);
  await history.undo();
  const noop = history.beginGesture([{ id, generation: 1, geometry }])!;
  noop.end();
  await vi.advanceTimersByTimeAsync(0);
  expect(history.store.getState().redo).toHaveLength(1);
  transport.update.mockResolvedValueOnce({ status: "closed", sequence: 1 });
  const gesture = history.beginGesture([{ id, generation: 1, geometry }])!;
  gesture.update([{ id, generation: 1, geometry: { ...geometry, x: 5 } }]);
  await vi.advanceTimersByTimeAsync(0);
  gesture.end();
  gesture.cancel();
  expect(history.store.getState().undo).toHaveLength(1);
  expect(history.store.getState().redo).toHaveLength(0);
});
test("disposal suppresses late stack updates and ends heartbeats", async () => {
  vi.useFakeTimers();
  const { history, transport, clear } = setup();
  let resolve!: (value: ActionOutcome) => void;
  transport.apply.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const request = history.perform(creation);
  await vi.advanceTimersByTimeAsync(0);
  history.dispose();
  resolve(outcome("create"));
  await request;
  expect(history.store.getState().undo).toHaveLength(0);
  expect(clear).not.toHaveBeenCalled();
});

test("facade blocks every inverse during a gesture but permits that gesture's own close", async () => {
  vi.useFakeTimers();
  const { history, transport } = setup();
  const first = history.beginGesture([{ id, generation: 1, geometry }])!;
  first.update([{ id, generation: 1, geometry: { ...geometry, x: 5 } }]);
  first.end();
  await vi.advanceTimersByTimeAsync(0);
  const second = history.beginGesture([{ id, generation: 1, geometry }])!;
  expect(await history.undo()).toBe(false);
  expect(transport.reverse).not.toHaveBeenCalled();
  second.update([{ id, generation: 1, geometry: { ...geometry, x: 10 } }]);
  second.end();
  await vi.advanceTimersByTimeAsync(0);
  expect(history.store.getState().undo).toHaveLength(2);
});

test("dispose during a submitted gesture closes its accepted cursor without reviving UI history", async () => {
  vi.useFakeTimers();
  const { history, transport, pending } = setup();
  let resolve!: (
    value: Awaited<ReturnType<HistoryTransport["update"]>>,
  ) => void;
  transport.update.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const gesture = history.beginGesture([{ id, generation: 1, geometry }])!;
  gesture.update([{ id, generation: 1, geometry: { ...geometry, x: 5 } }]);
  await vi.advanceTimersByTimeAsync(0);
  history.dispose();
  resolve({ status: "accepted", sequence: 1 });
  await vi.advanceTimersByTimeAsync(0);
  expect(transport.close).toHaveBeenCalledTimes(1);
  expect(transport.close.mock.calls[0][0].sequence).toBe(1);
  expect(history.store.getState().undo).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(transport.heartbeat).not.toHaveBeenCalled();
  expect(pending).toHaveBeenCalledTimes(1);
});
