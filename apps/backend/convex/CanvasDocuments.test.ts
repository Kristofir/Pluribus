/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { register as presence } from "@convex-dev/presence/test";
import { test, expect } from "vitest";
import schema from "./schema";
import { documentLimits } from "@pluribus/core/canvas/domain";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 0, y: 0, width: 430, height: 500 };
const insert = JSON.stringify({
  stepType: "replace",
  from: 1,
  to: 1,
  slice: { content: [{ type: "text", text: "Child A" }] },
});
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  presence(t);
  return t;
}
test("atomic creation, bounded retained children, distinct text and ownership checks", async () => {
  const t = setup();
  await expect(
    t.mutation(api.Canvas.createDocument, {
      geometry: { ...geometry, width: -1 },
    }),
  ).rejects.toThrow();
  expect(await t.query(api.Canvas.documentCards, {})).toEqual([]);
  expect(documentLimits.maxCount).toBe(100);
  for (let i = 0; i < documentLimits.maxCount; i++)
    await t.mutation(api.Canvas.createDocument, { geometry });
  expect(await t.query(api.Canvas.documentCards, {})).toHaveLength(100);
  await expect(
    t.mutation(api.Canvas.createDocument, { geometry }),
  ).rejects.toThrow("100");
  const [a, b] = await t.query(api.Canvas.documentCards, {});
  await t.mutation(api.Documents.submitSteps, {
    id: `${a.documentId}:1`,
    version: 1,
    clientId: "a",
    steps: [insert],
  });
  expect(
    await t.query(api.Documents.latestVersion, { id: `${b.documentId}:1` }),
  ).toBe(1);
  await expect(
    t.mutation(api.Documents.submitSteps, {
      id: a.documentId,
      version: 2,
      clientId: "a",
      steps: [insert],
    }),
  ).rejects.toThrow("generation");
  await t.run((ctx) => ctx.db.patch(a.documentId, { element: b.id }));
  await expect(
    t.query(api.Documents.getSnapshot, { id: `${a.documentId}:1` }),
  ).rejects.toThrow("ownership");
});
test("removal and restoration reject old text, geometry, snapshots and presence while retaining content", async () => {
  const t = setup();
  await t.mutation(api.Canvas.createDocument, { geometry });
  const [a] = await t.query(api.Canvas.documentCards, {});
  const oldId = `${a.documentId}:1`;
  await t.mutation(api.Documents.submitSteps, {
    id: oldId,
    version: 1,
    clientId: "a",
    steps: [insert],
  });
  const context = { kind: "document", id: a.documentId } as const;
  const browser = await t.mutation(api.Presence.claimBrowser, {
    secret: "a".repeat(64),
    epoch: 1,
    account: null,
    tabId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  });
  const lease = await t.mutation(api.Presence.join, {
    browser: browser!,
    context,
    guestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    tabId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  });
  const deletion = {
    operation: crypto.randomUUID(),
    secret: crypto.randomUUID(),
  };
  await t.mutation(api.Canvas.deleteDocument, {
    id: a.id,
    generation: 1,
    ...deletion,
  });
  expect(await t.query(api.Presence.roster, { context })).toEqual([]);
  await expect(
    t.mutation(api.Documents.submitSteps, {
      id: oldId,
      version: 2,
      clientId: "a",
      steps: [insert],
    }),
  ).rejects.toThrow("removed");
  await t.mutation(api.Canvas.undoDeletion, deletion);
  expect(
    await t.mutation(api.Canvas.changeDocument, {
      id: a.id,
      generation: 1,
      change: { kind: "geometry", geometry: { ...geometry, x: 100 } },
    }),
  ).toBe(false);
  await expect(
    t.mutation(api.Documents.submitSteps, {
      id: oldId,
      version: 2,
      clientId: "a",
      steps: [insert],
    }),
  ).rejects.toThrow("expired");
  await expect(
    t.mutation(api.Documents.submitSnapshot, {
      id: oldId,
      version: 1,
      content: "{}",
    }),
  ).rejects.toThrow("expired");
  await expect(
    t.mutation(api.Presence.publish, {
      context,
      ...lease,
      sequence: 1,
      activity: { kind: "text", range: null },
    }),
  ).rejects.toThrow("capability");
  expect(
    await t.query(api.Documents.latestVersion, { id: `${a.documentId}:3` }),
  ).toBe(2);
  expect(
    (
      await t.query(api.Documents.getSteps, {
        id: `${a.documentId}:3`,
        version: 1,
      })
    ).steps,
  ).toEqual([insert]);
});

test("failure inside text initialization rolls back the already inserted canvas child and metadata", async () => {
  // Missing component registration deliberately fails after metadata insertion.
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.Canvas.createDocument, { geometry }),
  ).rejects.toThrow();
  expect(await t.query(api.Canvas.documentCards, {})).toEqual([]);
  expect(
    await t.run((ctx) =>
      ctx.db.query("documents").withIndex("by_key").take(10),
    ),
  ).toEqual([]);
});
