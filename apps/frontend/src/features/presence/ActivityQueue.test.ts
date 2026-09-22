import { afterEach, expect, test, vi } from "vitest";
import { createActivityQueue } from "./ActivityQueue";
afterEach(() => vi.useRealTimers());
test("coalesces independently, prioritizes clear, and drops queued work when disposed", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const send = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const queue = createActivityQueue(send, () => {});
  for (let x = 0; x < 100; x++)
    queue.publish({ kind: "pointer", point: { x, y: 0 } });
  await vi.advanceTimersByTimeAsync(80);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]).toEqual([
    { kind: "pointer", point: { x: 99, y: 0 } },
    1,
  ]);
  queue.publish({ kind: "pointer", point: { x: 100, y: 0 } });
  queue.publish({ kind: "pointer", point: null });
  release();
  await vi.advanceTimersByTimeAsync(1);
  expect(send.mock.calls[1]).toEqual([{ kind: "pointer", point: null }, 2]);
  queue.publish({ kind: "selection", elements: ["a"] });
  await vi.advanceTimersByTimeAsync(80);
  expect(send.mock.calls[2]).toEqual([
    { kind: "selection", elements: ["a"] },
    1,
  ]);
  queue.publish({ kind: "pointer", point: { x: 200, y: 0 } });
  queue.dispose();
  release();
  await vi.runAllTimersAsync();
  expect(send).toHaveBeenCalledTimes(3);
});

test("send cadence includes request time instead of adding another full delay", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const send = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const queue = createActivityQueue(send, () => {});
  queue.publish({ kind: "pointer", point: { x: 1, y: 0 } });
  await vi.advanceTimersByTimeAsync(40);
  queue.publish({ kind: "pointer", point: { x: 2, y: 0 } });
  await vi.advanceTimersByTimeAsync(20);
  release();
  await vi.advanceTimersByTimeAsync(19);
  expect(send).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(send).toHaveBeenCalledTimes(2);
  // A slow request never overlaps another, and only the latest pending point survives.
  queue.publish({ kind: "pointer", point: { x: 3, y: 0 } });
  queue.publish({ kind: "pointer", point: { x: 4, y: 0 } });
  await vi.advanceTimersByTimeAsync(150);
  expect(send).toHaveBeenCalledTimes(2);
  release();
  await vi.advanceTimersByTimeAsync(1);
  expect(send.mock.calls[2]).toEqual([
    { kind: "pointer", point: { x: 4, y: 0 } },
    3,
  ]);
  queue.dispose();
});

test("retries a failed clear with its original sequence and caps backoff", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockRejectedValue(new Error("offline"));
  const failed = vi.fn();
  const queue = createActivityQueue(send, failed);
  const clear = { kind: "pointer", point: null } as const;
  queue.publish(clear);
  await vi.advanceTimersByTimeAsync(1);
  for (const delay of [100, 200, 400, 800, 1600, 2000, 2000])
    await vi.advanceTimersByTimeAsync(delay);
  expect(send).toHaveBeenCalledTimes(8);
  expect(
    send.mock.calls.every(
      ([activity, sequence]) => activity === clear && sequence === 1,
    ),
  ).toBe(true);
  send.mockResolvedValue(undefined);
  await vi.advanceTimersByTimeAsync(2000);
  expect(send).toHaveBeenCalledTimes(9);
  await vi.advanceTimersByTimeAsync(4000);
  expect(send).toHaveBeenCalledTimes(9);
  expect(failed).toHaveBeenCalledTimes(8);
  queue.dispose();
});

test("a new drag supersedes a failed clear before retry", async () => {
  vi.useFakeTimers();
  const send = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost ACK"))
    .mockResolvedValue(undefined);
  const queue = createActivityQueue(send, () => {});
  queue.publish({ kind: "manipulation", elements: [], operation: null });
  await vi.advanceTimersByTimeAsync(1);
  const drag = {
    kind: "manipulation",
    elements: ["a"],
    operation: "drag",
  } as const;
  queue.publish({ ...drag, elements: [...drag.elements] });
  await vi.advanceTimersByTimeAsync(1000);
  expect(send.mock.calls).toEqual([
    [{ kind: "manipulation", elements: [], operation: null }, 1],
    [drag, 2],
  ]);
  queue.dispose();
});

test("a newer state arriving during a failed retry wins without overlapping requests", async () => {
  vi.useFakeTimers();
  let reject!: (reason: Error) => void;
  const send = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost ACK"))
    .mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(undefined);
  const queue = createActivityQueue(send, () => {});
  queue.publish({ kind: "pointer", point: null });
  await vi.advanceTimersByTimeAsync(101);
  queue.publish({ kind: "pointer", point: { x: 1, y: 2 } });
  queue.publish({ kind: "pointer", point: { x: 3, y: 4 } });
  await vi.advanceTimersByTimeAsync(500);
  expect(send).toHaveBeenCalledTimes(2);
  reject(new Error("retry failed"));
  await vi.advanceTimersByTimeAsync(1);
  expect(send.mock.calls[2]).toEqual([
    { kind: "pointer", point: { x: 3, y: 4 } },
    2,
  ]);
  await vi.advanceTimersByTimeAsync(3000);
  expect(send).toHaveBeenCalledTimes(3);
  queue.dispose();
});

test("dispose cancels retry timers and late failures cannot affect a replacement queue", async () => {
  vi.useFakeTimers();
  let reject!: (reason: Error) => void;
  const send = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost ACK"))
    .mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
  const failed = vi.fn();
  const old = createActivityQueue(send, failed);
  old.publish({ kind: "pointer", point: null });
  await vi.advanceTimersByTimeAsync(101);
  old.publish({ kind: "selection", elements: [] });
  old.dispose();
  const freshSend = vi.fn().mockResolvedValue(undefined);
  const fresh = createActivityQueue(freshSend, failed);
  fresh.publish({ kind: "pointer", point: { x: 5, y: 6 } });
  reject(new Error("old retry failed"));
  await vi.advanceTimersByTimeAsync(5000);
  expect(send).toHaveBeenCalledTimes(2);
  expect(failed).toHaveBeenCalledTimes(1);
  expect(freshSend.mock.calls).toEqual([
    [{ kind: "pointer", point: { x: 5, y: 6 } }, 1],
  ]);
  fresh.dispose();
});
