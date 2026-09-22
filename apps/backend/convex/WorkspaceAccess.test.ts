/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register as registerPresence } from "@convex-dev/presence/test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import schema from "./schema";
import { documentLimits } from "@pluribus/core/canvas/domain";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const box = { x: 0, y: 0, width: 430, height: 500 };
const token = () => crypto.randomUUID();
async function setup() {
  const t = convexTest(schema, modules);
  register(t);
  registerPresence(t);
  const users = await t.run(async (ctx) => [
    await ctx.db.insert("users", {
      email: "a@example.test",
      emailVerificationTime: 1,
    }),
    await ctx.db.insert("users", {
      email: "b@example.test",
      emailVerificationTime: 1,
    }),
    await ctx.db.insert("users", { email: "a@example.test" }),
  ]);
  const a = t.withIdentity({ subject: users[0] }),
    b = t.withIdentity({ subject: users[1] }),
    unverified = t.withIdentity({ subject: users[2] });
  const w1 = await t.mutation(internal.workspaces.Provisioning.provision, {
    slug: "one",
    name: "One",
    assignments: [{ email: "a@example.test", admin: true }],
  });
  const w2 = await t.mutation(internal.workspaces.Provisioning.provision, {
    slug: "two",
    name: "Two",
    assignments: [{ email: "b@example.test", admin: false }],
  });
  await a.mutation(api.Workspaces.claim);
  await b.mutation(api.Workspaces.claim);
  await unverified.mutation(api.Workspaces.claim);
  return { t, a, b, unverified, w1, w2 };
}
test("preassignment binds verified accounts only; listing and admin enforce independent authority", async () => {
  const { t, a, b, unverified, w1, w2 } = await setup();
  expect((await a.query(api.Workspaces.list)).map((w) => w.id)).toEqual([w1]);
  expect((await b.query(api.Workspaces.list)).map((w) => w.id)).toEqual([w2]);
  expect(await t.query(api.Workspaces.list)).toEqual([]);
  expect(await unverified.query(api.Workspaces.list)).toEqual([]);
  await expect(
    b.query(api.Workspaces.open, { workspaceId: w1 }),
  ).rejects.toThrow("access denied");
  const args = {
    table: "users" as const,
    paginationOpts: { numItems: 10, cursor: null },
  };
  expect((await a.query(api.Workspaces.admin, args)).page).toHaveLength(3);
  await expect(b.query(api.Workspaces.admin, args)).rejects.toThrow(
    "Administrator",
  );
});
test("private canonical documents deny every old text/presence read and write surface", async () => {
  const { t, a, b, w1 } = await setup();
  const panel = await a.query(api.Workspaces.open, { workspaceId: w1 });
  const id = `${panel.mainDocumentId}:1`;
  for (const client of [t, b]) {
    await expect(
      client.query(api.Documents.getSnapshot, { id }),
    ).rejects.toThrow("access denied");
    await expect(
      client.query(api.Documents.latestVersion, { id }),
    ).rejects.toThrow("access denied");
    await expect(
      client.query(api.Documents.getSteps, { id, version: 1 }),
    ).rejects.toThrow("access denied");
    await expect(
      client.mutation(api.Documents.openAuthorship, { id }),
    ).rejects.toThrow("access denied");
    await expect(
      client.query(api.Documents.authors, { id, authors: [] }),
    ).rejects.toThrow("access denied");
    await expect(
      client.mutation(api.Documents.submitSnapshot, {
        id,
        version: 1,
        content: "{}",
      }),
    ).rejects.toThrow("access denied");
    await expect(
      client.mutation(api.Documents.submitSteps, {
        id,
        version: 1,
        clientId: "bad",
        steps: [],
      }),
    ).rejects.toThrow("access denied");
    await expect(
      client.query(api.Presence.roster, {
        context: { kind: "document", id: panel.mainDocumentId },
      }),
    ).rejects.toThrow("access denied");
    await expect(
      client.query(api.Presence.activities, {
        context: { kind: "canvas", id: w1 },
      }),
    ).rejects.toThrow("access denied");
  }
  expect(await a.query(api.Documents.latestVersion, { id })).toBe(1);
  expect(
    await a.query(api.Presence.roster, {
      context: { kind: "document", id: panel.mainDocumentId },
    }),
  ).toEqual([]);
});
test("private spatial records stay outside legacy scope and panel children cannot be moved or deleted", async () => {
  const { t, a, b, w1, w2 } = await setup();
  const r = await a.mutation(api.Canvas.createDocument, {
    workspaceId: w1,
    geometry: box,
  });
  expect(await t.query(api.Canvas.documentCards, {})).toEqual([]);
  expect(await b.query(api.Canvas.documentCards, { workspaceId: w2 })).toEqual(
    [],
  );
  await expect(
    t.query(api.Canvas.documentCards, { workspaceId: w1 }),
  ).rejects.toThrow("access denied");
  expect(
    await t.mutation(api.Canvas.changeDocument, {
      id: r,
      generation: 1,
      change: { kind: "geometry", geometry: { ...box, x: 50 } },
    }),
  ).toBe(false);
  await expect(
    b.mutation(api.Canvas.changeDocument, {
      workspaceId: w1,
      id: r,
      generation: 1,
      change: { kind: "geometry", geometry: box },
    }),
  ).rejects.toThrow("access denied");
  const session = await a.mutation(api.Canvas.openHistorySession, {
    workspaceId: w1,
    nonce: token(),
    secret: "11111111-1111-1111-1111-111111111111",
  });
  const auth = { session, secret: "11111111-1111-1111-1111-111111111111" };
  const main = await a.query(api.Workspaces.open, { workspaceId: w1 });
  const child = await t.run(
    async (ctx) => (await ctx.db.get(main.mainDocumentId))!.element!,
  );
  const result = await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id: child, generation: 1 },
  });
  expect(result.status).not.toBe("applied");
  expect(
    await a.mutation(api.Canvas.changeDocument, {
      workspaceId: w1,
      id: child,
      generation: 1,
      change: { kind: "geometry", geometry: box },
    }),
  ).toBe(false);
  expect(
    await a.query(api.Canvas.documentCards, { workspaceId: w1 }),
  ).toMatchObject([{ id: r, geometry: box }]);
  await expect(
    b.query(api.Canvas.readHistoryAction, { ...auth, action: token() }),
  ).rejects.toThrow();
  const foreign = await b.mutation(api.Canvas.createDocument, {
    workspaceId: w2,
    geometry: box,
  });
  const denied = await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id: foreign, generation: 1 },
  });
  expect(denied.status).not.toBe("applied");
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", w1))
      .first();
    await ctx.db.delete(membership!._id);
  });
  await expect(
    a.query(api.Canvas.readHistoryAction, { ...auth, action: token() }),
  ).rejects.toThrow("access denied");
});
test("explicit card roles count toward visible capacity, panel children do not", async () => {
  const { a, t, w1 } = await setup();
  const first = await a.mutation(api.Canvas.createDocument, {
    workspaceId: w1,
    geometry: box,
  });
  await t.run((ctx) => ctx.db.patch(first, { role: "card" }));
  for (let i = 1; i < documentLimits.maxCount; i++)
    await a.mutation(api.Canvas.createDocument, {
      workspaceId: w1,
      geometry: box,
    });
  expect(
    await a.query(api.Canvas.documentCards, { workspaceId: w1 }),
  ).toHaveLength(100);
  await expect(
    a.mutation(api.Canvas.createDocument, { workspaceId: w1, geometry: box }),
  ).rejects.toThrow("100");
});
test("private presence publishes and is revoked with membership; private History completes lifecycle", async () => {
  const { t, a, w1 } = await setup();
  const context = { kind: "canvas" as const, id: String(w1) };
  const tabId = token();
  const browser = await a.mutation(api.Presence.claimBrowser, {
    secret: "a".repeat(64),
    epoch: 1,
    tabId,
    account: (await a.query(api.Users.current, {}))!.id,
  });
  const presence = await a.mutation(api.Presence.join, {
    browser: browser!,
    context,
    guestId: token(),
    tabId,
  });
  expect(
    await a.mutation(api.Presence.publish, {
      ...presence,
      context,
      sequence: 1,
      activity: { kind: "pointer", point: { x: 1, y: 2 } },
    }),
  ).toBe(true);
  expect(await a.query(api.Presence.activities, { context })).toHaveLength(1);
  const secret = token(),
    session = await a.mutation(api.Canvas.openHistorySession, {
      workspaceId: w1,
      secret,
      nonce: token(),
    }),
    auth = { session, secret };
  const created = await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "create", element: { kind: "document", geometry: box } },
  });
  expect(created.status).toBe("applied");
  const action = token(),
    deleted = await a.mutation(api.Canvas.applyHistoryAction, {
      ...auth,
      action,
      attempt: token(),
      input: { kind: "delete", id: created.id!, generation: 1 },
    });
  expect(deleted.status).toBe("applied");
  expect(await a.query(api.Canvas.documentCards, { workspaceId: w1 })).toEqual(
    [],
  );
  expect(
    (
      await a.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action,
        attempt: token(),
        revision: deleted.revision,
        undo: true,
      })
    ).status,
  ).toBe("applied");
  expect(
    await a.query(api.Canvas.documentCards, { workspaceId: w1 }),
  ).toHaveLength(1);
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", w1))
      .first();
    await ctx.db.delete(membership!._id);
  });
  await expect(
    a.mutation(api.Presence.publish, {
      ...presence,
      context,
      sequence: 2,
      activity: { kind: "pointer", point: null },
    }),
  ).rejects.toThrow("access denied");
  await expect(
    a.mutation(api.Presence.heartbeat, { ...presence, context }),
  ).rejects.toThrow("access denied");
});
test("private document presence joins and publishes but existing capability cannot survive membership revocation", async () => {
  const { t, a, b, w1 } = await setup();
  const panel = await a.query(api.Workspaces.open, { workspaceId: w1 });
  const context = { kind: "document" as const, id: panel.mainDocumentId };
  const tabId = token();
  const browser = await a.mutation(api.Presence.claimBrowser, {
    secret: "a".repeat(64),
    epoch: 1,
    tabId,
    account: (await a.query(api.Users.current, {}))!.id,
  });
  const participation = await a.mutation(api.Presence.join, {
    browser: browser!,
    context,
    guestId: token(),
    tabId,
  });
  expect(
    await a.mutation(api.Presence.publish, {
      ...participation,
      context,
      sequence: 1,
      activity: { kind: "text", range: { version: 1, anchor: 1, head: 1 } },
    }),
  ).toBe(true);
  expect(await a.query(api.Presence.activities, { context })).toHaveLength(1);
  await expect(b.query(api.Presence.activities, { context })).rejects.toThrow(
    "access denied",
  );
  await t.run(async (ctx) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", w1))
      .first();
    await ctx.db.delete(member!._id);
  });
  await expect(
    a.mutation(api.Presence.publish, {
      ...participation,
      context,
      sequence: 2,
      activity: { kind: "text", range: null },
    }),
  ).rejects.toThrow("access denied");
  await expect(
    a.mutation(api.Presence.heartbeat, { ...participation, context }),
  ).rejects.toThrow("access denied");
});
test("explicit operator approval upgrades only the existing approved administrator assignment", async () => {
  const { t, a, b, w1, w2 } = await setup();
  await expect(
    t.mutation(internal.workspaces.Provisioning.authorizeAdministrator, {
      workspaceId: w2,
      email: "missing@example.test",
    }),
  ).rejects.toThrow("Existing assignment required");
  await t.mutation(internal.workspaces.Provisioning.authorizeAdministrator, {
    workspaceId: w2,
    email: "b@example.test",
  });
  const query = {
    table: "users" as const,
    paginationOpts: { numItems: 10, cursor: null },
  };
  await expect(b.query(api.Workspaces.admin, query)).rejects.toThrow(
    "Administrator",
  );
  await b.mutation(api.Workspaces.claim);
  expect((await b.query(api.Workspaces.admin, query)).page).toHaveLength(3);
  expect((await a.query(api.Workspaces.list)).map((w) => w.id)).toEqual([w1]);
  expect((await b.query(api.Workspaces.list)).map((w) => w.id)).toEqual([w2]);
});
