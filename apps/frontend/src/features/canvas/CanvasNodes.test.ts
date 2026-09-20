import { expect, test, vi } from "vitest";
import type {
  CanvasElement,
  DocumentElement,
  ElementId,
} from "@pluribus/core/canvas/domain";
import { createCanvasStore } from "./CanvasStore";
import { createCanvasNodeProjector } from "./CanvasNodes";

const rectangle = {
  id: "rectangle",
  canvasId: "shared",
  kind: "rectangle",
  generation: 1,
  removed: false,
  color: "blue",
  geometry: { x: 0, y: 0, width: 160, height: 100 },
} as CanvasElement;
const document = {
  id: "document",
  canvasId: "shared",
  kind: "document",
  documentId: "text",
  generation: 1,
  removed: false,
  geometry: { x: 200, y: 0, width: 430, height: 500 },
} as DocumentElement;
function setup() {
  const store = createCanvasStore<ElementId>(() => new Promise(() => {}));
  store.getState().setEnabled(true);
  const actions = { pending: vi.fn(), contentHeight: vi.fn() };
  const project = createCanvasNodeProjector();
  const render = (records = [rectangle, document], connected = true) =>
    project(records, store.getState(), connected, actions);
  return { store, actions, render };
}

test("moving one node preserves other nodes and document callbacks", () => {
  const { store, render } = setup();
  const before = render();
  store.getState().stage(rectangle.id, { ...rectangle.geometry, x: 45 }, true);
  const after = render();
  expect(after[0].position.x).toBe(45);
  expect(after[0]).not.toBe(before[0]);
  expect(after[0].data).toBe(before[0].data);
  expect(after[1]).toBe(before[1]);
  expect(render()).toBe(after);
});

test("selection and editing invalidate only affected nodes", () => {
  const { store, render } = setup();
  const before = render();
  store.getState().selectOnly(rectangle.id);
  const selected = render();
  expect(selected[0].selected).toBe(true);
  expect(selected[1]).toBe(before[1]);
  store.getState().setEditing(document.id);
  const editing = render();
  expect(editing[0]).toBe(selected[0]);
  if (editing[1].type !== "document") throw new Error("Expected document");
  expect(editing[1].data.editing).toBe(true);
});

test("generation changes refresh editor identity; disconnection disables nodes", () => {
  const { render, actions } = setup();
  const before = render();
  const restored = { ...document, generation: 3 };
  const after = render([rectangle, restored]);
  expect(after[0]).toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
  if (after[1].type !== "document") throw new Error("Expected document");
  expect(after[1].data.generation).toBe(3);
  after[1].data.contentHeight(2400);
  expect(actions.contentHeight).toHaveBeenCalledWith(document.id, 3, 2400);
  after[1].data.pending(true);
  expect(actions.pending).toHaveBeenCalledWith(document.id, true);
  const offline = render([rectangle, restored], false);
  expect(offline.every((node) => !node.data.editable)).toBe(true);
  expect(offline[1].draggable).toBe(false);
});

test("deleted entries leave the cache and re-created nodes get fresh references", () => {
  const { render } = setup();
  const before = render();
  expect(render([document])).toEqual([before[1]]);
  expect(render()[0]).not.toBe(before[0]);
});

test("deleted documents disappear and pending callbacks survive geometry and focus changes", () => {
  const { render, store } = setup();
  const before = render();
  store.getState().setEditing(document.id);
  const focused = render();
  if (focused[1].type !== "document" || before[1].type !== "document")
    throw new Error("Expected documents");
  expect(focused[1].data.pending).toBe(before[1].data.pending);
  expect(render([rectangle, { ...document, removed: true }])).toHaveLength(1);
});
