import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "@pluribus/backend/dataModel";
import type { GestureAck } from "@pluribus/core/canvas/history";
import type { GeometryBatch } from "./HistoryTransport";
import { createGeometryGesture } from "./GeometryGesture";
const geometry = { x: 0, y: 0, width: 400, height: 500 };
const targets = ["rectangle", "document"].map((id) => ({
  id: id as Id<"rectangles">,
  generation: 1,
  geometry,
}));
const moved = (x: number) =>
  targets.map((u) => ({ ...u, geometry: { ...geometry, x } }));
function setup() {
  vi.useFakeTimers();
  const send = vi.fn(async (batch: GeometryBatch): Promise<GestureAck> => ({
    status: "accepted",
    sequence: batch.sequence,
  }));
  const close = vi.fn(async (_seq: number, _uncertain?: GeometryBatch) => true);
  const heartbeat = vi.fn(async () => true),
    finished = vi.fn(),
    preview = vi.fn();
  const gesture = createGeometryGesture({
    action: "action",
    targets,
    send,
    close,
    heartbeat,
    finished,
    preview,
  });
  return { gesture, send, close, heartbeat, finished, preview };
}
afterEach(() => vi.useRealTimers());
test("live group updates coalesce and end submits latest geometry before close", async () => {
  const { gesture, send, close, finished } = setup();
  gesture.update(moved(10));
  await vi.advanceTimersByTimeAsync(10);
  gesture.update(moved(20));
  gesture.update(moved(30));
  expect(send).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(40);
  expect(send.mock.calls[1][0].updates).toEqual(moved(30));
  gesture.update(moved(40));
  gesture.end();
  await vi.advanceTimersByTimeAsync(0);
  expect(send.mock.calls[2][0].updates).toEqual(moved(40));
  expect(close).toHaveBeenCalledWith(3, undefined);
  expect(finished).toHaveBeenCalledTimes(1);
});
test("end waits for in-flight update and then submits the latest queued geometry", async () => {
  const { gesture, send, close } = setup();
  let resolve!: (ack: GestureAck) => void;
  send.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  gesture.update(moved(10));
  gesture.update(moved(40));
  gesture.end();
  expect(close).not.toHaveBeenCalled();
  resolve({ status: "accepted", sequence: 1 });
  await vi.advanceTimersByTimeAsync(0);
  expect(send.mock.calls[1][0].updates).toEqual(moved(40));
  expect(close).toHaveBeenCalledWith(2, undefined);
});
test("cancel drops unsent positions, waits for in-flight ACK and closes accepted sequence", async () => {
  const { gesture, send, close } = setup();
  let resolve!: (ack: GestureAck) => void;
  send.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  gesture.update(moved(10));
  gesture.update(moved(90));
  gesture.cancel();
  resolve({ status: "accepted", sequence: 1 });
  await vi.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledWith(1, undefined);
});
test("lost update ACK passes the exact uncertain batch to durable recovery", async () => {
  const { gesture, send, close } = setup();
  send.mockRejectedValueOnce(new Error("lost"));
  gesture.update(moved(10));
  await vi.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledWith(0, send.mock.calls[0][0]);
});
test("peer conflict closes earlier accepted work instead of erasing its existence", async () => {
  const { gesture, send, close } = setup();
  gesture.update(moved(10));
  await vi.advanceTimersByTimeAsync(50);
  send.mockResolvedValueOnce({ status: "conflict", sequence: 1 });
  gesture.update(moved(40));
  await vi.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledWith(1, undefined);
});
test("lease heartbeat rejection cancels; neither end nor cancel can restart it", async () => {
  const { gesture, heartbeat, close } = setup();
  gesture.update(moved(10));
  await vi.advanceTimersByTimeAsync(0);
  heartbeat.mockResolvedValueOnce(false);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(close).toHaveBeenCalledWith(1, undefined);
  gesture.update(moved(90));
  gesture.end();
  gesture.cancel();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(heartbeat).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});
