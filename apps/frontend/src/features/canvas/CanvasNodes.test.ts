import { expect, test, vi } from "vitest";
import type {
  CanvasElement,
  DocumentElement,
  ElementId,
} from "@pluribus/core/canvas/domain";
import { createCanvasStore } from "./CanvasStore";
import { createCanvasNodeProjector } from "./CanvasNodes";

const firstDocument = {
  id: "first-document",
  canvasId: "shared",
  kind: "document",
  generation: 1,
  removed: false,
  documentId: "first-text",
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
  const render = (records = [firstDocument, document], connected = true) =>
    project(
      records,
      store.getState(),
      { interactionEnabled: connected, readPaused: false },
      actions,
    );
  return { store, actions, render };
}

test("moving one node preserves other nodes and document callbacks", () => {
  const { store, render } = setup();
  const before = render();
  store
    .getState()
    .stage(firstDocument.id, { ...firstDocument.geometry, x: 45 }, true);
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
  store.getState().selectOnly(firstDocument.id);
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
  const after = render([firstDocument, restored]);
  expect(after[0]).toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
  if (after[1].type !== "document") throw new Error("Expected document");
  expect(after[1].data.generation).toBe(3);
  after[1].data.contentHeight(2400);
  expect(actions.contentHeight).toHaveBeenCalledWith(document.id, 3, 2400);
  after[1].data.pending(true);
  expect(actions.pending).toHaveBeenCalledWith(document.id, true);
  const offline = render([firstDocument, restored], false);
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
  expect(render([firstDocument, { ...document, removed: true }])).toHaveLength(
    1,
  );
});

test("interaction locks and read failures remain distinct across cached projections", () => {
  const { store, actions } = setup();
  const project = createCanvasNodeProjector();
  const render = (interactionEnabled: boolean, readPaused: boolean) => {
    const node = project(
      [document],
      store.getState(),
      { interactionEnabled, readPaused },
      actions,
    )[0];
    if (node.type !== "document") throw new Error("Expected document");
    return node;
  };
  const ready = render(true, false);
  const locked = render(false, false);
  expect(locked.data.editable).toBe(false);
  expect(locked.data.readPaused).toBe(false);
  expect(locked.data.generation).toBe(ready.data.generation);
  const failed = render(false, true);
  expect(failed.data.readPaused).toBe(true);
  expect(failed).not.toBe(locked);
  expect(render(false, false).data.readPaused).toBe(false);
  expect(render(true, false).data.editable).toBe(true);
});

test("retired rectangles are excluded even when an old projection contains one", () => {
  const { render } = setup();
  const retired = {
    ...firstDocument,
    kind: "rectangle",
    color: "blue",
  } as CanvasElement;
  expect(render([retired, document]).map((n) => n.id)).toEqual([document.id]);
});

test("Web Page nodes retain identity during unrelated document movement and expose capture actions", () => {
  const store = createCanvasStore<ElementId>(() => Promise.resolve(true));
  const project = createCanvasNodeProjector();
  const source = {
    id: "source",
    canvasId: "workspace",
    kind: "source",
    geometry: { x: 10, y: 20, width: 400, height: 360 },
    generation: 1,
    removed: false,
  } as CanvasElement;
  const open = vi.fn();
  const actions = {
    pending: vi.fn(),
    contentHeight: vi.fn(),
    sources: {
      workspaceId:
        "workspace" as import("@pluribus/backend/dataModel").Id<"workspaces">,
      views: new Map([
        [
          "source",
          {
            id: "source",
            url: "https://example.com",
            status: "ready" as const,
            hasCapture: true,
            preview: "Captured",
          },
        ],
      ]),
      open,
    },
  };
  const render = (doc = document) =>
    project(
      [source, doc],
      store.getState(),
      { interactionEnabled: true, readPaused: false },
      actions,
    );
  const first = render();
  const second = render({
    ...document,
    geometry: { ...document.geometry, x: 500 },
  });
  expect(second[0]).toBe(first[0]);
  expect(second[0].type).toBe("source");
  if (second[0].type !== "source") throw new Error("Expected source");
  second[0].data.open();
  second[0].data.contentHeight(420);
  expect(actions.contentHeight).toHaveBeenCalledWith("source", 1, 420);
  expect(open).toHaveBeenCalledWith("source");
  expect(
    project(
      [{ ...source, removed: true }],
      store.getState(),
      { interactionEnabled: true, readPaused: false },
      actions,
    ),
  ).toEqual([]);
});

test("Image cards participate in mixed canvas projection without remounting on unrelated movement", () => {
  const { render } = setup();
  const image = {
    id: "image-1",
    canvasId: "workspace",
    kind: "image",
    generation: 1,
    removed: false,
    geometry: { x: 40, y: 50, width: 360, height: 276 },
    name: "sample.png",
    url: "https://example.com/image.png",
  } as CanvasElement;
  const first = render([image, document]);
  expect(first[0]).toMatchObject({
    type: "image",
    selected: false,
    draggable: true,
  });
  if (first[0].type !== "image") throw new Error("Expected image");
  expect(first[0].data.name).toBe("sample.png");
  expect(first[0].data.url).toBe("https://example.com/image.png");
  const moved = render([
    image,
    { ...document, geometry: { ...document.geometry, x: 420 } },
  ]);
  expect(moved[0]).toBe(first[0]);
  expect(
    render([{ ...image, removed: true }, document]).map((n) => n.id),
  ).toEqual([document.id]);
});
