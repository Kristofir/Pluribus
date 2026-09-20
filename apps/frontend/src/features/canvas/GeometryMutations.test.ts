import { expect, test, vi } from "vitest";
import type {
  DocumentElement,
  RectangleElement,
} from "@pluribus/core/canvas/domain";
import { geometryTarget, sendGeometry } from "./GeometryMutations";

const geometry = { x: 10, y: -20, width: 430, height: 500 };
const rectangle: RectangleElement = {
  id: "rectangle" as RectangleElement["id"],
  kind: "rectangle",
  generation: 1,
  removed: false,
  canvasId: "shared",
  geometry,
  color: "blue",
};
const document: DocumentElement = {
  id: "element" as DocumentElement["id"],
  kind: "document",
  canvasId: "shared",
  geometry,
  documentId: "text" as DocumentElement["documentId"],
  generation: 3,
  removed: false,
};

test("geometry routes by kind, preserves both identities, and never guesses a missing target", async () => {
  const mutations = {
    rectangle: vi.fn(async () => true),
    document: vi.fn(async () => true),
  };
  expect(await sendGeometry(undefined, geometry, mutations)).toBe(false);
  expect(mutations.rectangle).not.toHaveBeenCalled();
  expect(mutations.document).not.toHaveBeenCalled();
  await sendGeometry(geometryTarget(document), geometry, mutations);
  expect(mutations.rectangle).not.toHaveBeenCalled();
  expect(mutations.document).toHaveBeenCalledExactlyOnceWith({
    id: "element",
    generation: 3,
    change: { kind: "geometry", geometry },
  });
  await sendGeometry(geometryTarget(rectangle), geometry, mutations);
  expect(mutations.rectangle).toHaveBeenCalledExactlyOnceWith({
    id: "rectangle",
    generation: 1,
    geometry,
  });
  expect(mutations.document).toHaveBeenCalledTimes(1);
});

test("a queued target keeps its captured generation across document restoration", async () => {
  const element = { ...document };
  const target = geometryTarget(element);
  element.generation = 5;
  const mutations = {
    rectangle: vi.fn(async () => true),
    document: vi.fn(async () => false),
  };
  expect(await sendGeometry(target, geometry, mutations)).toBe(false);
  expect(mutations.document).toHaveBeenCalledExactlyOnceWith({
    id: "element",
    generation: 3,
    change: { kind: "geometry", geometry },
  });
});
