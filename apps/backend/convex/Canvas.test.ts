/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { historyCredentials } from "./canvas/HistoryCredentials";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 10, y: 20, width: 430, height: 500 };
const token = () => crypto.randomUUID();
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

test("retired rectangles remain stored but cannot list, create, move or delete through old endpoints", async () => {
  const t = setup();
  const id = await t.run((ctx) =>
    ctx.db.insert("rectangles", { ...geometry, color: "blue", generation: 1 }),
  );
  const before = await t.run((ctx) => ctx.db.get(id));
  expect(await t.query(api.Canvas.list, {})).toEqual([]);
  await expect(
    t.mutation(api.Canvas.create, { geometry, color: "blue" }),
  ).rejects.toThrow("retired");
  await expect(
    t.mutation(api.Canvas.createElement, {
      operation: token(),
      secret: token(),
      element: { kind: "rectangle", geometry, color: "blue" },
    }),
  ).rejects.toThrow("retired");
  expect(
    await t.mutation(api.Canvas.updateGeometry, {
      id,
      generation: 1,
      geometry: { ...geometry, x: 999 },
    }),
  ).toBe(false);
  expect(
    (
      await t.mutation(api.Canvas.deleteElement, {
        id,
        generation: 1,
        operation: token(),
        secret: token(),
      })
    ).status,
  ).toBe("conflict");
  expect(
    (
      await t.mutation(api.Canvas.applyGeometry, {
        operation: token(),
        secret: token(),
        sequence: 1,
        final: true,
        updates: [{ id, generation: 1, geometry: { ...geometry, x: 99 } }],
      })
    ).status,
  ).toBe("conflict");
  expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
});

test("retired rectangle deletion and geometry receipts cannot revive or mutate stored rows", async () => {
  const t = setup();
  const operation = token(),
    secret = token();
  const { credential } = await t.run((ctx) =>
    historyCredentials(ctx, operation, secret),
  );
  const id = await t.run(async (ctx) => {
    const id = await ctx.db.insert("rectangles", {
      ...geometry,
      color: "blue",
      generation: 2,
      removed: true,
    });
    await ctx.db.insert("canvasDeletions", {
      operation,
      element: id,
      generation: 2,
      owner: null,
      proof: credential.proof,
    });
    await ctx.db.insert("canvasGeometryOperations", {
      operation,
      owner: null,
      proof: credential.proof,
      sequence: 1,
      revision: 0,
      closed: true,
      undone: false,
      changes: [
        { id, generation: 2, before: { ...geometry, x: 0 }, after: geometry },
      ],
    });
    return id;
  });
  const before = await t.run((ctx) => ctx.db.get(id));
  expect(
    (await t.mutation(api.Canvas.undoDeletion, { operation, secret })).status,
  ).toBe("conflict");
  expect(
    (
      await t.mutation(api.Canvas.reverseGeometry, {
        operation,
        secret,
        revision: 0,
        undo: true,
      })
    ).status,
  ).toBe("conflict");
  expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
});

test("V2 old rectangle create/delete/geometry History becomes obsolete without changing stored rows", async () => {
  const t = setup(),
    secret = token(),
    session = await t.mutation(api.Canvas.openHistorySession, {
      nonce: token(),
      secret,
    });
  const id = await t.run((ctx) =>
    ctx.db.insert("rectangles", {
      ...geometry,
      color: "gold",
      removed: true,
      generation: 2,
    }),
  );
  const before = await t.run((ctx) => ctx.db.get(id));
  await expect(
    t.mutation(api.Canvas.applyHistoryAction, {
      session,
      secret,
      action: token(),
      attempt: token(),
      input: {
        kind: "create",
        element: { kind: "rectangle", geometry, color: "gold" },
      },
    }),
  ).rejects.toThrow("retired");
  for (const kind of ["create", "delete", "geometry"] as const) {
    const action = token();
    await t.run((ctx) =>
      ctx.db.insert("canvasHistoryActions", {
        session,
        action,
        version: 2,
        revision: 1,
        state: kind === "create" ? "undone" : "applied",
        payload:
          kind === "geometry"
            ? {
                kind,
                sequence: 1,
                fingerprint: "old",
                deadline: 0,
                changes: [
                  {
                    id,
                    lineage: "old",
                    generation: 2,
                    before: geometry,
                    after: { ...geometry, x: 99 },
                  },
                ],
              }
            : {
                kind,
                id,
                lineage: "old",
                deletion: "old",
                deletedGeneration: 2,
              },
      }),
    );
    expect(
      (
        await t.mutation(api.Canvas.reverseHistoryAction, {
          session,
          secret,
          action,
          attempt: token(),
          revision: 1,
          undo: kind !== "create",
        })
      ).status,
    ).toBe("obsolete");
  }
  expect(
    (
      await t.mutation(api.Canvas.updateHistoryGesture, {
        session,
        secret,
        action: token(),
        sequence: 1,
        updates: [{ id, generation: 2, geometry }],
      })
    ).status,
  ).toBe("conflict");
  expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
});
