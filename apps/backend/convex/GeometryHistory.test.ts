/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 0, y: 0, width: 400, height: 500 };
const credential = () => ({
  operation: crypto.randomUUID(),
  secret: crypto.randomUUID(),
});
async function setup() {
  const t = convexTest(schema, modules);
  register(t);
  const firstDocument = await t.mutation(api.Canvas.createDocument, {
    geometry,
  });
  const document = await t.mutation(api.Canvas.createDocument, { geometry });
  return { t, firstDocument, document };
}
test("live document-group writes coalesce into one receipt; Undo/Redo restore authoritative geometry atomically", async () => {
  const { t, firstDocument, document } = await setup();
  const proof = credential();
  const updates = [firstDocument, document].map((id) => ({
    id,
    generation: 1,
    geometry: { ...geometry, x: 20 },
  }));
  await t.mutation(api.Canvas.applyGeometry, {
    ...proof,
    sequence: 1,
    final: false,
    updates,
  });
  const final = {
    ...proof,
    sequence: 2,
    final: true,
    updates: updates.map((u) => ({
      ...u,
      geometry: { ...u.geometry, x: 40, width: 600 },
    })),
  };
  expect(await t.mutation(api.Canvas.applyGeometry, final)).toEqual({
    status: "applied",
    revision: 0,
  });
  expect(await t.mutation(api.Canvas.applyGeometry, final)).toEqual({
    status: "applied",
    revision: 0,
  });
  const receipts = await t.run((ctx) =>
    ctx.db.query("canvasGeometryOperations").withIndex("by_operation").take(10),
  );
  expect(receipts).toHaveLength(1);
  expect(receipts[0].changes.map((c) => c.before)).toEqual([
    geometry,
    geometry,
  ]);
  expect(
    await t.mutation(api.Canvas.reverseGeometry, {
      ...proof,
      revision: 0,
      undo: true,
    }),
  ).toEqual({ status: "applied", revision: 1 });
  expect(
    await t.mutation(api.Canvas.reverseGeometry, {
      ...proof,
      revision: 0,
      undo: true,
    }),
  ).toEqual({ status: "applied", revision: 1 });
  expect(await t.query(api.Canvas.documentCards, {})).toMatchObject([
    { id: firstDocument, geometry },
    { id: document, geometry },
  ]);
  await t.mutation(api.Canvas.reverseGeometry, {
    ...proof,
    revision: 1,
    undo: false,
  });
  expect(await t.query(api.Canvas.documentCards, {})).toMatchObject([
    { id: firstDocument, geometry: { x: 40, width: 600 } },
    { id: document, geometry: { x: 40, width: 600 } },
  ]);
  expect(
    (
      await t.mutation(api.Canvas.reverseGeometry, {
        ...proof,
        revision: 0,
        undo: true,
      })
    ).status,
  ).toBe("conflict");
});
test("a collaborator changing any group member prevents every Undo write", async () => {
  const { t, firstDocument, document } = await setup();
  const proof = credential();
  await t.mutation(api.Canvas.applyGeometry, {
    ...proof,
    sequence: 1,
    final: true,
    updates: [firstDocument, document].map((id) => ({
      id,
      generation: 1,
      geometry: { ...geometry, x: 40 },
    })),
  });
  await t.mutation(api.Canvas.changeDocument, {
    id: document,
    generation: 1,
    change: { kind: "geometry", geometry: { ...geometry, x: 90 } },
  });
  expect(
    (
      await t.mutation(api.Canvas.reverseGeometry, {
        ...proof,
        revision: 0,
        undo: true,
      })
    ).status,
  ).toBe("conflict");
  expect(await t.query(api.Canvas.documentCards, {})).toMatchObject([
    { id: firstDocument, geometry: { x: 40 } },
    { id: document, geometry: { x: 90 } },
  ]);
});
test("rejected batches write neither partial geometry nor receipts; no-op gestures are not history actions", async () => {
  const { t, firstDocument, document } = await setup();
  const proof = credential();
  await expect(
    t.mutation(api.Canvas.applyGeometry, {
      ...proof,
      sequence: 1,
      final: true,
      updates: [
        { id: firstDocument, generation: 1, geometry: { ...geometry, x: 30 } },
        { id: document, generation: 1, geometry: { ...geometry, width: -1 } },
      ],
    }),
  ).rejects.toThrow();
  expect(
    (await t.query(api.Canvas.documentCards, {})).find(
      (card) => card.id === firstDocument,
    ),
  ).toMatchObject({ geometry: { x: 0 } });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("canvasGeometryOperations")
        .withIndex("by_operation")
        .take(10),
    ),
  ).toEqual([]);
  expect(
    (
      await t.mutation(api.Canvas.applyGeometry, {
        ...proof,
        sequence: 1,
        final: true,
        updates: [{ id: firstDocument, generation: 1, geometry }],
      })
    ).status,
  ).toBe("unchanged");
});
test("receipt credentials and lifecycle generations protect geometry restoration", async () => {
  const { t, firstDocument } = await setup();
  const user = await t.run((ctx) => ctx.db.insert("users", {}));
  const owner = t.withIdentity({ subject: user });
  const proof = credential();
  await owner.mutation(api.Canvas.applyGeometry, {
    ...proof,
    sequence: 1,
    final: true,
    updates: [
      { id: firstDocument, generation: 1, geometry: { ...geometry, x: 30 } },
    ],
  });
  await expect(
    t.mutation(api.Canvas.reverseGeometry, {
      ...proof,
      revision: 0,
      undo: true,
    }),
  ).rejects.toThrow("another editing session");
  await expect(
    owner.mutation(api.Canvas.reverseGeometry, {
      ...proof,
      secret: crypto.randomUUID(),
      revision: 0,
      undo: true,
    }),
  ).rejects.toThrow("another editing session");
  const deletion = credential();
  await owner.mutation(api.Canvas.deleteElement, {
    id: firstDocument,
    generation: 1,
    ...deletion,
  });
  await owner.mutation(api.Canvas.undoDeletion, deletion);
  expect(
    (
      await owner.mutation(api.Canvas.reverseGeometry, {
        ...proof,
        revision: 0,
        undo: true,
      })
    ).status,
  ).toBe("conflict");
});
test("an interrupted stream seals the last submitted sequence without replaying stale movement", async () => {
  const { t, firstDocument } = await setup();
  const first = {
    ...credential(),
    sequence: 1,
    final: false,
    updates: [
      { id: firstDocument, generation: 1, geometry: { ...geometry, x: 20 } },
    ],
  };
  await t.mutation(api.Canvas.applyGeometry, first);
  await t.mutation(api.Canvas.applyGeometry, { ...first, final: true });
  expect(
    (
      await t.mutation(api.Canvas.applyGeometry, {
        ...first,
        sequence: 2,
        updates: [{ ...first.updates[0], geometry: { ...geometry, x: 50 } }],
      })
    ).status,
  ).toBe("conflict");
  await t.mutation(api.Canvas.reverseGeometry, {
    operation: first.operation,
    secret: first.secret,
    revision: 0,
    undo: true,
  });
  expect(
    (await t.query(api.Canvas.documentCards, {})).find(
      (card) => card.id === firstDocument,
    ),
  ).toMatchObject({ geometry: { x: 0 } });
});
test("successive gestures on the same Element can undo and redo in sequence", async () => {
  const { t, firstDocument } = await setup();
  const first = credential(),
    second = credential();
  for (const [proof, x] of [
    [first, 10],
    [second, 20],
  ] as const)
    await t.mutation(api.Canvas.applyGeometry, {
      ...proof,
      sequence: 1,
      final: true,
      updates: [
        { id: firstDocument, generation: 1, geometry: { ...geometry, x } },
      ],
    });
  for (const proof of [second, first])
    await t.mutation(api.Canvas.reverseGeometry, {
      ...proof,
      revision: 0,
      undo: true,
    });
  expect(
    (await t.query(api.Canvas.documentCards, {})).find(
      (card) => card.id === firstDocument,
    ),
  ).toMatchObject({ geometry: { x: 0 } });
  for (const proof of [first, second])
    await t.mutation(api.Canvas.reverseGeometry, {
      ...proof,
      revision: 1,
      undo: false,
    });
  expect(
    (await t.query(api.Canvas.documentCards, {})).find(
      (card) => card.id === firstDocument,
    ),
  ).toMatchObject({ geometry: { x: 20 } });
});
