import { expect, test, vi, afterEach } from "vitest";
import {
  createPresenceRegistry,
  type Transport,
  type Credentials,
  type Context,
} from "./Registry";
const context = { kind: "canvas", id: "shared" } as const;
const identity = {
  guestId: "guest",
  tabId: "tab",
  name: "Guest",
  color: "blue",
};
afterEach(() => vi.useRealTimers());
function setup() {
  let count = 0;
  const transport: Transport = {
    join: vi.fn(async (): Promise<Credentials> => ({
      id: `session-${++count}` as Credentials["id"],
      capability: "aaaa-bbbb-cccc-dddd-eeee",
    })),
    leave: vi.fn(async () => null),
    heartbeat: vi.fn(async () => true),
    lifecycle: vi.fn(async () => true),
    publish: vi.fn(async () => true),
    watch: vi.fn(() => ({ read: () => [], dispose: vi.fn() })),
  };
  const registry = createPresenceRegistry(transport, Promise.resolve(identity));
  registry.emit({
    type: "environment-changed",
    environment: {
      online: true,
      ownsBrowser: true,
      visible: true,
      focused: true,
    },
  });
  return { registry, transport };
}
test("duplicate surfaces share membership/subscriptions; one release leaves the other active", async () => {
  vi.useFakeTimers();
  const { registry, transport } = setup();
  const a = registry.acquire(context),
    b = registry.acquire(context);
  await vi.advanceTimersByTimeAsync(1);
  expect(transport.join).toHaveBeenCalledTimes(1);
  expect(transport.watch).toHaveBeenCalledTimes(3);
  a.release();
  await vi.advanceTimersByTimeAsync(200);
  expect(transport.leave).not.toHaveBeenCalled();
  b.emit({ type: "pointer-moved", point: { x: 1, y: 2 } });
  await vi.advanceTimersByTimeAsync(80);
  expect(transport.publish).toHaveBeenCalledTimes(1);
  b.release();
  await vi.advanceTimersByTimeAsync(200);
  expect(transport.leave).toHaveBeenCalledTimes(1);
});
test("simultaneous contexts and StrictMode reacquire preserve independent participation", async () => {
  vi.useFakeTimers();
  const { registry, transport } = setup();
  const a = registry.acquire(context);
  a.release();
  const b = registry.acquire(context);
  const c = registry.acquire({
    kind: "document",
    id: "fixture" as Extract<Context, { kind: "document" }>["id"],
  });
  await vi.advanceTimersByTimeAsync(200);
  expect(transport.join).toHaveBeenCalledTimes(2);
  expect(transport.leave).not.toHaveBeenCalled();
  b.release();
  await vi.advanceTimersByTimeAsync(200);
  expect(transport.leave).toHaveBeenCalledTimes(1);
  c.release();
  await vi.advanceTimersByTimeAsync(200);
});
test("hidden tabs stop heartbeat and return with a fresh incarnation, dropping queued activity", async () => {
  vi.useFakeTimers();
  const { registry, transport } = setup();
  const a = registry.acquire(context);
  await vi.advanceTimersByTimeAsync(1);
  a.emit({ type: "pointer-moved", point: { x: 1, y: 2 } });
  registry.emit({
    type: "environment-changed",
    environment: {
      online: true,
      ownsBrowser: true,
      visible: false,
      focused: false,
    },
  });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(transport.heartbeat).not.toHaveBeenCalled();
  expect(transport.publish).not.toHaveBeenCalled();
  registry.emit({
    type: "environment-changed",
    environment: {
      online: true,
      ownsBrowser: true,
      visible: true,
      focused: true,
    },
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(transport.join).toHaveBeenCalledTimes(2);
  expect(transport.leave).toHaveBeenCalledTimes(1);
  a.release();
  await vi.advanceTimersByTimeAsync(200);
});
test("late join responses are released instead of reviving a disconnected participation", async () => {
  vi.useFakeTimers();
  const { registry, transport } = setup();
  let resolve!: (value: Credentials) => void;
  transport.join = vi.fn(
    () =>
      new Promise<Credentials>((r) => {
        resolve = r;
      }),
  );
  const a = registry.acquire(context);
  await vi.advanceTimersByTimeAsync(1);
  registry.emit({
    type: "environment-changed",
    environment: {
      online: false,
      ownsBrowser: true,
      visible: true,
      focused: true,
    },
  });
  resolve({
    id: "late" as Credentials["id"],
    capability: "aaaa-bbbb-cccc-dddd-eeee",
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(a.getSnapshot().id).toBeNull();
  expect(transport.leave).toHaveBeenCalledTimes(1);
  a.release();
  await vi.advanceTimersByTimeAsync(200);
});

test("window and editor blur retain activity and heartbeat; surface release clears it", async () => {
  vi.useFakeTimers();
  const { registry, transport } = setup();
  const document = { kind: "document", id: "fixture" } as Context;
  const a = registry.acquire(document),
    b = registry.acquire(document);
  const range = { version: 1, anchor: 1, head: 3 };
  // Interaction before join completion is retained and published when ready.
  a.emit({ type: "text-selection-changed", range, focused: true });
  await vi.advanceTimersByTimeAsync(100);
  expect(transport.publish).toHaveBeenCalledTimes(1);
  a.emit({ type: "editor-blurred" });
  registry.emit({
    type: "environment-changed",
    environment: {
      online: true,
      ownsBrowser: true,
      visible: true,
      focused: false,
    },
  });
  a.emit({ type: "text-selection-changed", range: null, focused: false });
  await vi.advanceTimersByTimeAsync(10_000);
  expect(transport.publish).toHaveBeenCalledTimes(1);
  expect(transport.heartbeat).toHaveBeenCalledTimes(1);
  expect(transport.join).toHaveBeenCalledTimes(1);
  a.release();
  await vi.advanceTimersByTimeAsync(1);
  expect(transport.publish).toHaveBeenLastCalledWith(
    document,
    expect.anything(),
    { kind: "text", range: null },
    2,
  );
  expect(transport.leave).not.toHaveBeenCalled();
  b.release();
  await vi.advanceTimersByTimeAsync(200);
});

test("a late publish rejection after hiding does not remove retained activity", async () => {
  vi.useFakeTimers();
  const { registry, transport } = setup();
  let resolve!: (accepted: boolean) => void;
  transport.publish = vi.fn(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  const lease = registry.acquire(context);
  await vi.advanceTimersByTimeAsync(1);
  lease.emit({ type: "pointer-moved", point: { x: 1, y: 2 } });
  await vi.advanceTimersByTimeAsync(80);
  registry.emit({
    type: "environment-changed",
    environment: {
      online: true,
      ownsBrowser: true,
      visible: false,
      focused: false,
    },
  });
  resolve(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(transport.leave).not.toHaveBeenCalled();
  expect(lease.getSnapshot().id).not.toBeNull();
  lease.release();
  await vi.advanceTimersByTimeAsync(200);
});

test("ownership handoff cancels failed updates and heartbeats; a successor gets fresh sequences", async () => {
  vi.useFakeTimers();
  const { registry, transport } = setup();
  const lease = registry.acquire(context);
  await vi.advanceTimersByTimeAsync(1);
  transport.publish = vi.fn().mockRejectedValue(new Error("offline"));
  lease.emit({ type: "pointer-moved", point: { x: 1, y: 2 } });
  await vi.advanceTimersByTimeAsync(80);
  registry.emit({
    type: "environment-changed",
    environment: {
      online: true,
      visible: true,
      focused: false,
      ownsBrowser: false,
    },
  });
  const sent = vi.mocked(transport.publish).mock.calls.length;
  lease.emit({ type: "pointer-moved", point: { x: 99, y: 99 } });
  await vi.advanceTimersByTimeAsync(30000);
  expect(transport.publish).toHaveBeenCalledTimes(sent);
  expect(transport.heartbeat).not.toHaveBeenCalled();
  expect(lease.getSnapshot().id).toBeNull();
  transport.publish = vi.fn().mockResolvedValue(true);
  registry.emit({
    type: "environment-changed",
    environment: {
      online: true,
      visible: true,
      focused: true,
      ownsBrowser: true,
    },
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(transport.join).toHaveBeenCalledTimes(2);
  expect(transport.publish).not.toHaveBeenCalled();
  lease.emit({ type: "pointer-moved", point: { x: 5, y: 6 } });
  await vi.advanceTimersByTimeAsync(80);
  expect(transport.publish).toHaveBeenLastCalledWith(
    context,
    expect.objectContaining({ id: "session-2" }),
    { kind: "pointer", point: { x: 5, y: 6 } },
    1,
  );
  lease.release();
  await vi.advanceTimersByTimeAsync(200);
});
