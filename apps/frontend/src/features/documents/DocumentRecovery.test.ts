import { expect, test } from "vitest";
import { createDocumentRecovery } from "./DocumentRecovery";
const copy = { json: '{"type":"doc"}', text: "Possibly unsaved", version: 7 };
test("acknowledgement clears a mounted pending copy but unmount retains it independently", () => {
  const store = createDocumentRecovery();
  store.getState().capture("doc:1", copy);
  store.getState().capture("doc:1", null);
  expect(store.getState().entries.size).toBe(0);
  store.getState().capture("doc:1", copy);
  store.getState().detach("doc:1");
  store.getState().capture("doc:1", null);
  expect(store.getState().entries.get("doc:1")).toEqual({
    ...copy,
    detached: true,
  });
});
test("restored generation cannot clear old recovery; only explicit discard removes it", () => {
  const store = createDocumentRecovery();
  store.getState().capture("doc:1", copy);
  store.getState().detach("doc:1");
  store.getState().capture("doc:3", null);
  expect(store.getState().entries.size).toBe(1);
  store.getState().discard("doc:1");
  expect(store.getState().entries.size).toBe(0);
});
