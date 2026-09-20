import { InvalidElementGeometry } from "../domain/Geometry";
import { expect, test } from "vitest";
import {
  createRectangle,
  updateRectangleGeometry,
  type RectanglePersistence,
} from "./Rectangles";
import { CanvasCapacityReached } from "../domain/Rectangle";

import type { RectangleElement, RectangleId } from "../domain/Element";

function memoryPersistence() {
  let next = 0;
  const records = new Map<RectangleId, RectangleElement>();
  const rectangles: RectanglePersistence = {
    countUpTo: async (limit) => Math.min(limit, records.size),
    get: async (id) => records.get(id) ?? null,
    insert: async (value) => {
      const id = String(++next) as RectangleId;
      records.set(id, {
        id,
        kind: "rectangle",
        canvasId: "shared",
        generation: 1,
        removed: false,
        ...value,
      });
      return id;
    },
    updateGeometry: async (id, geometry) => {
      const record = records.get(id);
      if (!record) throw new Error("Missing record");
      records.set(id, { ...record, geometry });
    },
    lifecycle: async (id, removed, generation) => {
      const record = records.get(id)!;
      records.set(id, { ...record, removed, generation });
    },
  };
  return { rectangles, records };
}
const actor = { kind: "anonymous" } as const;
const input = {
  geometry: { x: 0, y: 0, width: 100, height: 100 },
  color: "blue",
} as const;

test("use cases reject invalid geometry and capacity before persistence changes", async () => {
  const deps = memoryPersistence();
  await expect(
    createRectangle(deps, actor, {
      ...input,
      geometry: { ...input.geometry, width: 0 },
    }),
  ).rejects.toThrow(InvalidElementGeometry);
  expect(deps.records.size).toBe(0);
  for (let i = 0; i < 200; i++) await createRectangle(deps, actor, input);
  await expect(createRectangle(deps, actor, input)).rejects.toThrow(
    CanvasCapacityReached,
  );
  expect(deps.records.size).toBe(200);
});

test("the core preserves color and prevents a late update from recreating a deleted rectangle", async () => {
  const deps = memoryPersistence();
  const id = await createRectangle(deps, actor, input);
  expect(
    await updateRectangleGeometry(
      deps,
      actor,
      id,
      {
        ...input.geometry,
        x: 15,
      },
      1,
    ),
  ).toBe(true);
  expect(deps.records.get(id)).toMatchObject({
    color: "blue",
    geometry: { x: 15 },
  });
  await deps.rectangles.lifecycle(id, true, 2);
  expect(
    await updateRectangleGeometry(deps, actor, id, input.geometry, 1),
  ).toBe(false);
  expect(deps.records.get(id)?.removed).toBe(true);
});
