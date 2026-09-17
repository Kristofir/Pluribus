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
