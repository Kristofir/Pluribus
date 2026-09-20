/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 10, y: 20, width: 160, height: 100 };
const credential = () => ({
  operation: crypto.randomUUID(),
  secret: crypto.randomUUID(),
});
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

test("rectangle deletion preserves identity/color/geometry; stale writes stay invalid after restore", async () => {
  const t = setup();
  const id = await t.mutation(api.Canvas.create, { geometry, color: "coral" });
  const command = { id, generation: 1, ...credential() };
  const proof = { operation: command.operation, secret: command.secret };
  expect(await t.mutation(api.Canvas.deleteElement, command)).toEqual({
    status: "deleted",
    generation: 2,
  });
  expect(await t.mutation(api.Canvas.deleteElement, command)).toEqual({
    status: "deleted",
    generation: 2,
  });
  expect(await t.query(api.Canvas.list, {})).toEqual([]);
  expect(
    await t.mutation(api.Canvas.updateGeometry, {
      id,
      generation: 1,
      geometry,
    }),
  ).toBe(false);
  expect(await t.mutation(api.Canvas.undoDeletion, proof)).toEqual({
    status: "restored",
    generation: 3,
  });
  expect(await t.mutation(api.Canvas.undoDeletion, proof)).toEqual({
    status: "restored",
    generation: 3,
  });
  expect(
    await t.mutation(api.Canvas.updateGeometry, {
      id,
      generation: 1,
      geometry: { ...geometry, x: 999 },
    }),
  ).toBe(false);
  expect(await t.query(api.Canvas.list, {})).toEqual([
    { id, ...geometry, color: "coral", generation: 3 },
  ]);
  expect((await t.mutation(api.Canvas.deleteElement, command)).status).toBe(
    "conflict",
  );
  const moved = { ...geometry, x: 120 };
  expect(
    await t.mutation(api.Canvas.updateGeometry, {
      id,
      generation: 3,
      geometry: moved,
    }),
  ).toBe(true);
  const redo = { id, generation: 3, ...credential() };
  await t.mutation(api.Canvas.deleteElement, redo);
  expect((await t.mutation(api.Canvas.undoDeletion, proof)).status).toBe(
    "conflict",
  );
  await t.mutation(api.Canvas.undoDeletion, {
    operation: redo.operation,
    secret: redo.secret,
  });
  expect(await t.query(api.Canvas.list, {})).toMatchObject([
    { id, ...moved, generation: 5 },
  ]);
});

test("legacy rectangles are active at generation one; deleted rows do not consume capacity", async () => {
  const t = setup();
  const id = await t.run((ctx) =>
    ctx.db.insert("rectangles", { ...geometry, color: "blue" }),
  );
  expect(await t.query(api.Canvas.list, {})).toMatchObject([
    { id, generation: 1 },
  ]);
  const proof = credential();
  await t.mutation(api.Canvas.deleteElement, { id, generation: 1, ...proof });
  await t.run(async (ctx) => {
    for (let i = 0; i < 199; i++)
      await ctx.db.insert("rectangles", { ...geometry, color: "blue" });
  });
  const replacement = await t.mutation(api.Canvas.create, {
    geometry,
    color: "gold",
  });
  expect(await t.query(api.Canvas.list, {})).toHaveLength(200);
  expect((await t.mutation(api.Canvas.undoDeletion, proof)).status).toBe(
    "full",
  );
  const receipt = await t.run((ctx) =>
    ctx.db
      .query("canvasDeletions")
      .withIndex("by_operation", (q) => q.eq("operation", proof.operation))
      .unique(),
  );
  expect(receipt?.restoredGeneration).toBeUndefined();
  await t.mutation(api.Canvas.deleteElement, {
    id: replacement,
    generation: 1,
    ...credential(),
  });
  expect((await t.mutation(api.Canvas.undoDeletion, proof)).status).toBe(
    "restored",
  );
});

test("receipts bind owner, capability and Element identity across types", async () => {
  const t = setup();
  const user = await t.run((ctx) => ctx.db.insert("users", {}));
  const owner = t.withIdentity({ subject: user });
  const id = await owner.mutation(api.Canvas.create, {
    geometry,
    color: "blue",
  });
  const document = await owner.mutation(api.Canvas.createDocument, {
    geometry,
  });
  const proof = credential();
  await owner.mutation(api.Canvas.deleteElement, {
    id,
    generation: 1,
    ...proof,
  });
  await expect(t.mutation(api.Canvas.undoDeletion, proof)).rejects.toThrow(
    "another editing session",
  );
  await expect(
    owner.mutation(api.Canvas.undoDeletion, {
      ...proof,
      secret: crypto.randomUUID(),
    }),
  ).rejects.toThrow("another editing session");
  await expect(
    owner.mutation(api.Canvas.deleteElement, {
      id: document,
      generation: 1,
      ...proof,
    }),
  ).rejects.toThrow("reused");
  expect(await owner.query(api.Canvas.documentCards, {})).toHaveLength(1);
  expect((await owner.mutation(api.Canvas.undoDeletion, proof)).status).toBe(
    "restored",
  );
  const documentProof = credential();
  await owner.mutation(api.Canvas.deleteElement, {
    id: document,
    generation: 1,
    ...documentProof,
  });
  expect(
    (await owner.mutation(api.Canvas.undoDeletion, documentProof)).status,
  ).toBe("restored");
});

test("rejected stale deletion writes no receipt", async () => {
  const t = setup();
  const id = await t.mutation(api.Canvas.create, { geometry, color: "blue" });
  const proof = credential();
  expect(
    (
      await t.mutation(api.Canvas.deleteElement, {
        id,
        generation: 9,
        ...proof,
      })
    ).status,
  ).toBe("conflict");
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("canvasDeletions")
        .withIndex("by_operation", (q) => q.eq("operation", proof.operation))
        .unique(),
    ),
  ).toBeNull();
});
