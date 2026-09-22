/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { hashSecret } from "./documents/Authors";

const modules = import.meta.glob("./**/*.ts");
const carolMessage =
  "Hello, Carol. This is a recording. At the tone, you can leave a message to request anything you might need. We'll do our best to provide it. Our feelings for you haven't changed, Carol. But after everything that's happened, we just need a little space.";

test("anonymous guests get isolated, idempotent real workspaces with Carol text", async () => {
  const backend = convexTest(schema, modules);
  register(backend);
  const [guestA, guestB, google] = await backend.run(async (ctx) => [
    await ctx.db.insert("users", { isAnonymous: true }),
    await ctx.db.insert("users", { isAnonymous: true }),
    await ctx.db.insert("users", { email: "member@example.test" }),
  ]);
  const a = backend.withIdentity({ subject: guestA });
  const b = backend.withIdentity({ subject: guestB });
  const signedIn = backend.withIdentity({ subject: google });
  await expect(
    backend.mutation(api.Workspaces.ensureLandingDemo, {}),
  ).rejects.toThrow("Anonymous session required");
  await expect(
    signedIn.mutation(api.Workspaces.ensureLandingDemo, {}),
  ).rejects.toThrow("Anonymous session required");
  expect((await a.query(api.Users.current, {}))?.isAnonymous).toBe(true);
  expect((await signedIn.query(api.Users.current, {}))?.isAnonymous).toBe(
    false,
  );

  const aId = await a.mutation(api.Workspaces.ensureLandingDemo, {});
  expect(await a.mutation(api.Workspaces.ensureLandingDemo, {})).toBe(aId);
  const bId = await b.mutation(api.Workspaces.ensureLandingDemo, {});
  expect(bId).not.toBe(aId);
  const cards = await a.query(api.Canvas.documentCards, { workspaceId: aId });
  expect(cards).toHaveLength(1);
  const snapshot = await a.query(api.Documents.getSnapshot, {
    id: `${cards[0].documentId}:1`,
  });
  expect(JSON.stringify(snapshot)).toContain(carolMessage);
  const pages = await a.query(api.Sources.cards, { workspaceId: aId });
  expect(pages).toHaveLength(1);
  expect(pages[0]).toMatchObject({
    url: "https://www.gatorade.com/sports-drinks/gatorade-thirst-quencher/fruit-punch",
    revision: 1,
  });
  await expect(
    b.query(api.Canvas.documentCards, { workspaceId: aId }),
  ).rejects.toThrow("access denied");
  await expect(
    backend.query(api.Canvas.documentCards, { workspaceId: aId }),
  ).rejects.toThrow("access denied");
  await expect(
    b.query(api.Documents.getSnapshot, { id: `${cards[0].documentId}:1` }),
  ).rejects.toThrow("access denied");
  await expect(
    a.mutation(api.Canvas.prepareImageUpload, { workspaceId: aId }),
  ).rejects.toThrow("Image upload is unavailable");
  await expect(
    a.mutation(api.Sources.request, {
      workspaceId: aId,
      url: "https://example.com",
    }),
  ).rejects.toThrow("Web Page capture is unavailable");
  expect(
    await a.query(api.Canvas.documentCards, { workspaceId: aId }),
  ).toHaveLength(1);
  await expect(
    a.mutation(api.ShareLinks.create, { workspaceId: aId }),
  ).rejects.toThrow("Share links are unavailable");
  await expect(
    a.mutation(api.AgentAccess.grant, {
      workspaceId: aId,
      label: "Demo agent",
    }),
  ).rejects.toThrow("Agent grants are unavailable");

  // Even stale links, erroneous membership rows, and verified email assignments
  // cannot add a second owner to an isolated guest canvas.
  const token = crypto.randomUUID() + crypto.randomUUID();
  await backend.run(async (ctx) => {
    await ctx.db.insert("workspaceShareLinks", {
      workspaceId: aId,
      createdBy: guestA,
      tokenHash: await hashSecret(token),
      revoked: false,
    });
    await ctx.db.insert("workspaceMembers", {
      workspaceId: aId,
      userId: guestB,
    });
    await ctx.db.insert("workspaceAssignments", {
      workspaceId: aId,
      email: "member@example.test",
      admin: false,
    });
  });
  await expect(b.mutation(api.ShareLinks.redeem, { token })).rejects.toThrow(
    "Share link unavailable",
  );
  await signedIn.mutation(api.Workspaces.claim, {});
  expect(await b.query(api.Workspaces.access, { workspaceId: aId })).toBe(
    false,
  );
  expect(
    await signedIn.query(api.Workspaces.access, { workspaceId: aId }),
  ).toBe(false);
  expect(
    (await b.query(api.Workspaces.list, {})).map((row) => row.id),
  ).not.toContain(aId);
  await expect(
    b.query(api.Canvas.documentCards, { workspaceId: aId }),
  ).rejects.toThrow("access denied");
});

test("reopening a guest canvas restores its text, cards, page position and capture", async () => {
  const backend = convexTest(schema, modules);
  register(backend);
  const guestId = await backend.run((ctx) =>
    ctx.db.insert("users", { isAnonymous: true }),
  );
  const guest = backend.withIdentity({ subject: guestId });
  const workspaceId = await guest.mutation(
    api.Workspaces.ensureLandingDemo,
    {},
  );
  const [original] = await guest.query(api.Canvas.documentCards, {
    workspaceId,
  });
  const [page] = await guest.query(api.Sources.cards, { workspaceId });
  await guest.mutation(api.Documents.submitSteps, {
    id: `${original.documentId}:${original.generation}`,
    version: 1,
    clientId: "demo-edit",
    steps: [
      JSON.stringify({
        stepType: "replace",
        from: 1,
        to: 1,
        slice: { content: [{ type: "text", text: "Edited " }] },
      }),
    ],
  });
  await guest.mutation(api.Canvas.createDocument, {
    workspaceId,
    geometry: { x: 100, y: 100, width: 420, height: 300 },
  });
  await backend.run(async (ctx) => {
    await ctx.db.patch(original.id, { x: 400, removed: true });
    await ctx.db.patch(page.id, {
      geometry: { x: 50, y: 50, width: 320, height: 230 },
      removed: true,
    });
  });

  expect(await guest.mutation(api.Workspaces.ensureLandingDemo, {})).toBe(
    workspaceId,
  );
  const cards = await guest.query(api.Canvas.documentCards, { workspaceId });
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    id: original.id,
    geometry: { x: 70, y: 100, width: 510, height: 355 },
  });
  expect(cards[0].generation).toBeGreaterThan(original.generation);
  const snapshot = await guest.query(api.Documents.getSnapshot, {
    id: `${cards[0].documentId}:${cards[0].generation}`,
  });
  expect(JSON.stringify(snapshot)).toContain(carolMessage);
  expect(JSON.stringify(snapshot)).not.toContain("Edited ");
  const pages = await guest.query(api.Sources.cards, { workspaceId });
  expect(pages).toHaveLength(1);
  expect(pages[0]).toMatchObject({
    id: page.id,
    revision: page.revision,
    geometry: { x: 655, y: 355, width: 320, height: 230 },
  });
});
