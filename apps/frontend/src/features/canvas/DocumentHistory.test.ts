import { expect, test, vi } from "vitest";
import type { FunctionArgs } from "convex/server";
import type { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { createDocumentHistory } from "./DocumentHistory";
const id = "card" as Id<"canvasDocuments">;
function setup() {
  let i = 0;
  const remove = vi.fn(
    async (_args: FunctionArgs<typeof api.Canvas.deleteDocument>) => ({
      status: "deleted" as const,
      generation: 2,
    }),
  );
  const restore = vi.fn(
    async (_args: FunctionArgs<typeof api.Canvas.undoDeletion>) => ({
      status: "restored" as const,
      generation: 3,
    }),
  );
  const history = createDocumentHistory({
    remove,
    restore,
    token: () => String(++i),
  });
  return { history, remove, restore };
}
test("personal Undo and Redo use the restored generation and a new deletion identity", async () => {
  const { history, remove, restore } = setup();
  await history.remove(id, 1);
  const first = history.store.getState().undo[0];
  await history.undo();
  expect(restore).toHaveBeenCalledWith({
    operation: first.operation,
    secret: first.secret,
  });
  expect(history.store.getState().undo).toHaveLength(0);
  await history.redo();
  expect(remove.mock.calls[1][0]).toMatchObject({ id, generation: 3 });
  expect(history.store.getState().undo[0].operation).not.toBe(first.operation);
});
test("ambiguous response retains identical request for retry and blocks competing history actions", async () => {
  const { history, remove } = setup();
  remove.mockRejectedValueOnce(new Error("response lost"));
  expect(await history.remove(id, 1)).toBe(false);
  expect(history.store.getState().undo).toHaveLength(0);
  expect(await history.remove(id, 1)).toBe(false);
  await history.store.getState().retry!();
  expect(remove.mock.calls[0]).toEqual(remove.mock.calls[1]);
  expect(history.store.getState().undo).toHaveLength(1);
});
test("capacity failure preserves undo entry; lifecycle conflict retires it", async () => {
  const { history } = setup();
  const remove = async () => ({ status: "deleted" as const, generation: 2 });
  let conflict = false;
  const h = createDocumentHistory({
    remove,
    restore: async () => ({
      status: conflict ? "conflict" : "full",
      generation: 2,
    }),
    token: () => "token",
  });
  await h.remove(id, 1);
  await h.undo();
  expect(h.store.getState().undo).toHaveLength(1);
  conflict = true;
  await h.undo();
  expect(h.store.getState().undo).toHaveLength(0);
  expect(history.store.getState().undo).toHaveLength(0);
});
test("a new deletion clears redo; concurrent calls cannot fork personal history", async () => {
  const { history, remove } = setup();
  await Promise.all([history.remove(id, 1), history.remove(id, 1)]);
  expect(remove).toHaveBeenCalledTimes(1);
  await history.undo();
  await history.remove(id, 3);
  expect(history.store.getState().redo).toHaveLength(0);
});
