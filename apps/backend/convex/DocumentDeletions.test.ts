/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { test, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 75, y: 120, width: 430, height: 500 };
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}
const credential = () => ({
  operation: crypto.randomUUID(),
  secret: crypto.randomUUID(),
});

test("delete hides child, frees capacity, and Undo restores identity, geometry and saved text", async () => {
  const t = setup();
  const id = await t.mutation(api.Canvas.createDocument, { geometry });
  const [card] = await t.query(api.Canvas.documentCards, {});
  const steps = [
    JSON.stringify({
      stepType: "replace",
      from: 1,
      to: 1,
      slice: { content: [{ type: "text", text: "Accepted before deletion" }] },
    }),
  ];
  await t.mutation(api.Documents.submitSteps, {
    id: `${card.documentId}:1`,
    version: 1,
    clientId: "test",
    steps,
  });
  const command = { id, generation: 1, ...credential() };
  expect(await t.mutation(api.Canvas.deleteDocument, command)).toEqual({
    status: "deleted",
    generation: 2,
  });
  expect(await t.query(api.Canvas.documentCards, {})).toEqual([]);
  const replacement = await t.mutation(api.Canvas.createDocument, { geometry });
  expect(
    await t.mutation(api.Canvas.undoDeletion, {
      operation: command.operation,
      secret: command.secret,
    }),
  ).toEqual({ status: "restored", generation: 3 });
  const cards = await t.query(api.Canvas.documentCards, {});
  expect(cards.map((c) => c.id)).toEqual([id, replacement]);
  expect(cards[0]).toEqual({ ...card, generation: 3 });
  expect(
    (
      await t.query(api.Documents.getSteps, {
        id: `${card.documentId}:3`,
        version: 1,
      })
    ).steps,
  ).toEqual(steps);
});

test("duplicate requests, ambiguous responses and older undo cannot affect a later deletion", async () => {
  const t = setup(),
    id = await t.mutation(api.Canvas.createDocument, { geometry });
  const first = { id, generation: 1, ...credential() };
  const undo = { operation: first.operation, secret: first.secret };
  expect(await t.mutation(api.Canvas.deleteDocument, first)).toEqual(
    await t.mutation(api.Canvas.deleteDocument, first),
  );
  expect(await t.mutation(api.Canvas.undoDeletion, undo)).toEqual(
    await t.mutation(api.Canvas.undoDeletion, undo),
  );
  expect((await t.mutation(api.Canvas.deleteDocument, first)).status).toBe(
    "conflict",
  );
  const next = { id, generation: 3, ...credential() };
  await t.mutation(api.Canvas.deleteDocument, next);
  expect((await t.mutation(api.Canvas.undoDeletion, undo)).status).toBe(
    "conflict",
  );
  expect(await t.query(api.Canvas.documentCards, {})).toEqual([]);
  expect(
    await t.mutation(api.Canvas.undoDeletion, {
      operation: next.operation,
      secret: next.secret,
    }),
  ).toEqual({ status: "restored", generation: 5 });
  expect(
    await t.run((ctx) =>
      ctx.db.query("canvasDeletions").withIndex("by_operation").take(10),
    ),
  ).toHaveLength(2);
});

test("capacity rejection keeps Undo available and commits neither receipt consumption nor lifecycle", async () => {
  const t = setup(),
    id = await t.mutation(api.Canvas.createDocument, { geometry });
  const proof = credential();
  await t.mutation(api.Canvas.deleteDocument, { id, generation: 1, ...proof });
  const second = await t.mutation(api.Canvas.createDocument, { geometry });
  await t.mutation(api.Canvas.createDocument, { geometry });
  expect((await t.mutation(api.Canvas.undoDeletion, proof)).status).toBe(
    "full",
  );
  expect(
    (
      await t.run((ctx) =>
        ctx.db
          .query("canvasDeletions")
          .withIndex("by_operation", (q) => q.eq("operation", proof.operation))
          .unique(),
      )
    )?.restoredGeneration,
  ).toBeUndefined();
  await t.mutation(api.Canvas.deleteDocument, {
    id: second,
    generation: 1,
    ...credential(),
  });
  expect((await t.mutation(api.Canvas.undoDeletion, proof)).status).toBe(
    "restored",
  );
});

test("wrong capability, reused operation and different signed-in caller cannot restore", async () => {
  const t = setup();
  const user = await t.run((ctx) => ctx.db.insert("users", {}));
  const otherUser = await t.run((ctx) => ctx.db.insert("users", {}));
  const owner = t.withIdentity({ subject: user });
  const other = t.withIdentity({ subject: otherUser });
  const id = await owner.mutation(api.Canvas.createDocument, { geometry });
  const otherId = await owner.mutation(api.Canvas.createDocument, { geometry });
  const proof = credential();
  await owner.mutation(api.Canvas.deleteDocument, {
    id,
    generation: 1,
    ...proof,
  });
  await expect(
    owner.mutation(api.Canvas.undoDeletion, {
      ...proof,
      secret: crypto.randomUUID(),
    }),
  ).rejects.toThrow("another editing session");
  await expect(other.mutation(api.Canvas.undoDeletion, proof)).rejects.toThrow(
    "another editing session",
  );
  await expect(t.mutation(api.Canvas.undoDeletion, proof)).rejects.toThrow(
    "another editing session",
  );
  await expect(
    owner.mutation(api.Canvas.deleteDocument, {
      id: otherId,
      generation: 1,
      ...proof,
    }),
  ).rejects.toThrow("reused");
  expect(
    (await owner.query(api.Canvas.documentCards, {})).map((c) => c.id),
  ).toEqual([otherId]);
  expect((await owner.mutation(api.Canvas.undoDeletion, proof)).status).toBe(
    "restored",
  );
});

test("concurrent deletions and restores serialize without duplicate generations", async () => {
  const t = setup(),
    id = await t.mutation(api.Canvas.createDocument, { geometry });
  const proof = credential();
  const results = await Promise.all([
    t.mutation(api.Canvas.deleteDocument, { id, generation: 1, ...proof }),
    t.mutation(api.Canvas.deleteDocument, {
      id,
      generation: 1,
      ...credential(),
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual(["conflict", "deleted"]);
  const row = (
    await t.run((ctx) =>
      ctx.db.query("canvasDeletions").withIndex("by_operation").take(10),
    )
  )[0];
  expect(row.generation).toBe(2);
});

test("legacy recovery preserves old placeholders but cannot restore new personal deletions", async () => {
  const t = setup(),
    id = await t.mutation(api.Canvas.createDocument, { geometry });
  await t.run((ctx) => ctx.db.patch(id, { removed: true, generation: 2 }));
  expect(
    await t.mutation(internal.canvas.LegacyDocuments.restoreLegacy, {}),
  ).toBe(1);
  expect((await t.query(api.Canvas.documentCards, {}))[0].generation).toBe(3);
  await t.mutation(api.Canvas.deleteDocument, {
    id,
    generation: 3,
    ...credential(),
  });
  expect(
    await t.mutation(internal.canvas.LegacyDocuments.restoreLegacy, {}),
  ).toBe(0);
  expect(await t.query(api.Canvas.documentCards, {})).toEqual([]);
});
