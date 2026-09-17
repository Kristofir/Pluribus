/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const initial = { x: 10, y: 20, width: 160, height: 100 };

test("anonymous clients share records; separate edits preserve the other rectangle", async () => {
  const t = convexTest(schema, modules);
  const first = await t.mutation(api.Canvas.create, {
    geometry: initial,
    color: "blue",
  });
  const second = await t.mutation(api.Canvas.create, {
    geometry: initial,
    color: "gold",
  });
  await t.mutation(api.Canvas.updateGeometry, {
    id: first,
    geometry: { ...initial, x: 80 },
  });
  await t.mutation(api.Canvas.updateGeometry, {
    id: second,
    geometry: { ...initial, width: 240 },
  });
  expect(await t.query(api.Canvas.list, {})).toMatchObject([
    { id: first, x: 80, width: 160, color: "blue" },
    { id: second, x: 10, width: 240, color: "gold" },
  ]);
});

test("the latest accepted complete geometry wins, while color is preserved", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(api.Canvas.create, {
    geometry: initial,
    color: "coral",
  });
  await t.mutation(api.Canvas.updateGeometry, {
    id,
    geometry: { ...initial, x: 400, width: 300 },
  });
  const last = { x: -20, y: 50, width: 90, height: 200 };
  await t.mutation(api.Canvas.updateGeometry, {
    id,
    geometry: last,
  });
  expect(await t.query(api.Canvas.list, {})).toMatchObject([
    { ...last, color: "coral" },
  ]);
});

test("delete is idempotent and a late drag cannot resurrect its rectangle", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(api.Canvas.create, {
    geometry: initial,
    color: "blue",
  });
  await t.mutation(api.Canvas.remove, { id });
  await t.mutation(api.Canvas.remove, { id });
  expect(
    await t.mutation(api.Canvas.updateGeometry, {
      id,
      geometry: initial,
    }),
  ).toBe(false);
  expect(await t.query(api.Canvas.list, {})).toEqual([]);
});

test.each([
  { ...initial, x: NaN },
  { ...initial, y: Infinity },
  { ...initial, width: 0 },
  { ...initial, height: 2001 },
  { ...initial, x: 100001 },
])(
  "invalid geometry cannot create or partially update a record: %j",
  async (geometry) => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.Canvas.create, { geometry, color: "blue" }),
    ).rejects.toThrow();
    const id = await t.mutation(api.Canvas.create, {
      geometry: initial,
      color: "blue",
    });
    await expect(
      t.mutation(api.Canvas.updateGeometry, { id, geometry }),
    ).rejects.toThrow();
    expect(await t.query(api.Canvas.list, {})).toMatchObject([initial]);
  },
);

test("the capacity guard prevents invisible records beyond the bounded query", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let i = 0; i < 200; i++)
      await ctx.db.insert("rectangles", { ...initial, color: "blue" });
  });
  await expect(
    t.mutation(api.Canvas.create, {
      geometry: initial,
      color: "gold",
    }),
  ).rejects.toThrow("200");
  expect(await t.query(api.Canvas.list, {})).toHaveLength(200);
});

test("signed-in and anonymous clients share the same canvas without caller-supplied authorization", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const signedIn = t.withIdentity({ subject: `${userId}|test-session` });
  const id = await signedIn.mutation(api.Canvas.create, {
    geometry: initial,
    color: "gold",
  });
  expect(await t.query(api.Canvas.list, {})).toMatchObject([
    { id, color: "gold" },
  ]);
  await t.mutation(api.Canvas.remove, { id });
  expect(await signedIn.query(api.Canvas.list, {})).toEqual([]);
});

test("client arguments cannot supply an actor to bypass the server-derived context", async () => {
  const t = convexTest(schema, modules);
  const untrusted = {
    geometry: initial,
    color: "blue" as const,
    actor: { kind: "authenticated" },
  };
  await expect(t.mutation(api.Canvas.create, untrusted)).rejects.toThrow();
  expect(await t.query(api.Canvas.list, {})).toEqual([]);
});
