import { afterEach, expect, test, vi } from "vitest";
import { createCanvasStore } from "./CanvasStore";
const geometry = { x: 0, y: 0, width: 160, height: 100 };
afterEach(() => vi.useRealTimers());

test("pointer events coalesce; release flushes the last geometry without waiting for the throttle", async () => {
  vi.useFakeTimers();
  const sent: number[] = [];
  const sync = createCanvasStore<string>(async (_id, g) => {
    sent.push(g.x);
    return true;
  });
  sync.getState().setEnabled(true);
  sync.getState().stage("a", geometry, true);
  await vi.advanceTimersByTimeAsync(10);
  sync.getState().stage("a", { ...geometry, x: 10 }, true);
  sync.getState().stage("a", { ...geometry, x: 20 }, true);
  expect(sent).toEqual([0]);
  expect(sync.getState().gestures.get("a")?.geometry.x).toBe(20);
  await vi.advanceTimersByTimeAsync(40);
  expect(sent).toEqual([0, 20]);
  sync.getState().stage("a", { ...geometry, x: 30 }, false);
  await vi.advanceTimersByTimeAsync(0);
  expect(sent).toEqual([0, 20, 30]);
  expect(sync.getState().gestures.size).toBe(0);
});

test("one request per object is in flight and the final update survives a slow acknowledgement", async () => {
  let resolveFirst!: (exists: boolean) => void;
  const send = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValue(true);
  const sync = createCanvasStore<string>(send);
  sync.getState().setEnabled(true);
  sync.getState().stage("a", geometry, true);
  sync.getState().stage("a", { ...geometry, x: 20 }, false);
  expect(send).toHaveBeenCalledTimes(1);
  resolveFirst(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenLastCalledWith("a", { ...geometry, x: 20 });
  expect(
    [...sync.getState().gestures.values()].filter((g) => g.sending || g.queued)
      .length,
  ).toBe(0);
  expect(sync.getState().gestures.size).toBe(0);
});

test("remote deletion cancels queued geometry even if a mutation resolves later", async () => {
  let finish!: (exists: boolean) => void;
  const send = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const sync = createCanvasStore<string>(send);
  sync.getState().setEnabled(true);
  sync.getState().stage("a", geometry, true);
  sync.getState().stage("a", { ...geometry, x: 20 }, false);
  sync.getState().retain(new Set());
  finish(true);
  await Promise.resolve();
  expect(send).toHaveBeenCalledTimes(1);
  expect(sync.getState().gestures.size).toBe(0);
});

test("disconnect discards unsent gestures, blocks editing, and permits fresh edits on reconnect", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockResolvedValue(true);
  const sync = createCanvasStore<string>(send);
  sync.getState().setEnabled(true);
  sync.getState().stage("a", geometry, true);
  await vi.advanceTimersByTimeAsync(0);
  sync.getState().stage("a", { ...geometry, x: 1 }, true);
  sync.getState().setEnabled(false);
  sync.getState().stage("b", geometry, false);
  await vi.advanceTimersByTimeAsync(100);
  expect(send).toHaveBeenCalledTimes(1);
  expect(sync.getState().gestures.size).toBe(0);
  sync.getState().setEnabled(true);
  sync.getState().stage("b", geometry, false);
  await vi.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledTimes(2);
});

test("rejected or deleted writes release the overlay without retrying", async () => {
  for (const send of [
    vi.fn().mockRejectedValue(new Error("failure")),
    vi.fn().mockResolvedValue(false),
  ]) {
    const sync = createCanvasStore<string>(send);
    sync.getState().setEnabled(true);
    sync.getState().stage("a", geometry, false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sync.getState().gestures.size).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  }
});

test("each mounted canvas has isolated interaction state and synchronous create guards", () => {
  const first = createCanvasStore<string>(async () => true);
  const second = createCanvasStore<string>(async () => true);
  first.getState().setEnabled(true);
  first.getState().selectOnly("a");
  expect(first.getState().beginCreate()).toBe(true);
  expect(first.getState().beginCreate()).toBe(false);
  expect(second.getState().selected.size).toBe(0);
  expect(second.getState().creating).toBe(false);
  first.getState().finishCreate();
  first.getState().retain(new Set());
  expect(first.getState().selected.size).toBe(0);
});
