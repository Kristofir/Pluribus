/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 80, y: 80, width: 400, height: 360 };
const token = () => crypto.randomUUID();
async function setup() {
  const t = convexTest(schema, modules);
  register(t);
  const { userId, workspaceId, foreignId } = await t.run(async (ctx) => ({
    userId: await ctx.db.insert("users", {}),
    workspaceId: await ctx.db.insert("workspaces", {
      name: "Pages",
      slug: "pages",
    }),
    foreignId: await ctx.db.insert("workspaces", {
      name: "Other",
      slug: "other",
    }),
  }));
  await t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { userId, workspaceId }),
  );
  const a = t.withIdentity({ subject: userId });
  const secret = token(),
    session = await a.mutation(api.Canvas.openHistorySession, {
      workspaceId,
      nonce: token(),
      secret,
    });
  return { t, a, workspaceId, foreignId, auth: { session, secret } };
}
async function capture(
  t: Awaited<ReturnType<typeof setup>>["t"],
  id: Id<"sources">,
  revision: number,
  content = "Original page",
) {
  await t.mutation(internal.sources.Jobs.begin, { id, revision });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision,
    capture: {
      id: `capture-${revision}`,
      content,
      title: "Example title",
      capturedAt: revision,
    },
  });
}
test("Web Page creation is recorded once, previews are bounded, full captures and source context are authorized", async () => {
  const { t, a, workspaceId, foreignId, auth } = await setup();
  const command = {
    ...auth,
    action: token(),
    attempt: token(),
    input: {
      kind: "create" as const,
      element: {
        kind: "source" as const,
        url: "https://example.com",
        prompt: "Main findings",
        geometry,
      },
    },
  };
  const result = await a.mutation(api.Canvas.applyHistoryAction, command);
  expect(result.status).toBe("applied");
  expect(await a.mutation(api.Canvas.applyHistoryAction, command)).toEqual(
    result,
  );
  const id = await t.run(async (ctx) =>
    ctx.db.normalizeId("sources", result.id!)!,
  );
  await capture(t, id, 1, "x".repeat(2000));
  const cards = await a.query(api.Sources.cards, { workspaceId });
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    id,
    geometry,
    generation: 1,
    capture: { title: "Example title", preview: "x".repeat(500) },
  });
  expect(cards[0].capture).not.toHaveProperty("content");
  expect(
    (await a.query(api.Sources.get, { workspaceId, id }))?.capture?.content,
  ).toHaveLength(2000);
  const snapshot = await a.mutation(api.AgentAccess.prepare, {
    workspaceId,
    elementIds: [id],
    passages: [],
  });
  expect(
    JSON.parse((await t.run((ctx) => ctx.db.get(snapshot)))!.content)
      .elements[0],
  ).toMatchObject({
    kind: "source",
    url: "https://example.com/",
    capture: { id: "capture-1" },
  });
  await expect(t.query(api.Sources.cards, { workspaceId })).rejects.toThrow(
    "access denied",
  );
  await expect(
    a.query(api.Sources.get, { workspaceId: foreignId, id }),
  ).rejects.toThrow("access denied");
  await expect(
    a.mutation(api.Sources.request, {
      workspaceId: foreignId,
      url: "https://example.com",
    }),
  ).rejects.toThrow("access denied");
  const sharedSecret = token(),
    sharedSession = await a.mutation(api.Canvas.openHistorySession, {
      nonce: token(),
      secret: sharedSecret,
    });
  await expect(
    a.mutation(api.Canvas.applyHistoryAction, {
      ...command,
      session: sharedSession,
      secret: sharedSecret,
      action: token(),
      attempt: token(),
    }),
  ).rejects.toThrow("private workspace");
});
test("refresh failures retain capture provenance; stale successes cannot replace it", async () => {
  const { t, a, workspaceId } = await setup();
  const id = await a.mutation(api.Sources.request, {
    workspaceId,
    url: "https://example.com/old",
    prompt: "Old prompt",
  });
  await capture(t, id, 1);
  await a.mutation(api.Sources.request, {
    workspaceId,
    sourceId: id,
    url: "https://example.com/new",
    prompt: "New prompt",
  });
  expect(
    (await a.query(api.Sources.get, { workspaceId, id }))?.capture,
  ).toMatchObject({
    content: "Original page",
    url: "https://example.com/old",
    prompt: "Old prompt",
  });
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 2 });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 2,
    error: "Provider failed",
  });
  expect(await a.query(api.Sources.get, { workspaceId, id })).toMatchObject({
    status: "failed",
    error: "Provider failed",
    capture: { content: "Original page" },
  });
  const snapshot = await a.mutation(api.AgentAccess.prepare, {
    workspaceId,
    elementIds: [id],
    passages: [],
  });
  expect(
    JSON.parse((await t.run((ctx) => ctx.db.get(snapshot)))!.content)
      .elements[0].url,
  ).toBe("https://example.com/old");
  await a.mutation(api.Sources.request, {
    workspaceId,
    sourceId: id,
    url: "https://example.com/new",
  });
  await capture(t, id, 3, "New page");
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 2,
    capture: { id: "stale", capturedAt: 9, content: "Stale" },
  });
  expect(
    (await a.query(api.Sources.get, { workspaceId, id }))?.capture,
  ).toMatchObject({
    content: "New page",
    url: "https://example.com/new",
    prompt: "New prompt",
  });
});
test("delete cancels in-flight capture, Undo retains identity/capture and rejects stale geometry", async () => {
  const { t, a, workspaceId, auth } = await setup();
  const id = await a.mutation(api.Sources.request, {
    workspaceId,
    url: "https://example.com",
    geometry,
  });
  await capture(t, id, 1);
  await a.mutation(api.Sources.request, {
    workspaceId,
    sourceId: id,
    url: "https://example.com",
  });
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 2 });
  const deletion = await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id, generation: 1 },
  });
  expect(deletion.status).toBe("applied");
  expect(await a.query(api.Sources.cards, { workspaceId })).toEqual([]);
  expect(await a.query(api.Sources.get, { workspaceId, id })).toBeNull();
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 2,
    capture: { id: "late", capturedAt: 3, content: "Must not reappear" },
  });
  await expect(
    a.mutation(api.AgentAccess.prepare, {
      workspaceId,
      elementIds: [id],
      passages: [],
    }),
  ).rejects.toThrow("unavailable");
  expect(
    (
      await a.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: deletion.action,
        attempt: token(),
        revision: 1,
        undo: true,
      })
    ).status,
  ).toBe("applied");
  expect(await a.query(api.Sources.get, { workspaceId, id })).toMatchObject({
    id,
    generation: 3,
    status: "failed",
    geometry,
    capture: { content: "Original page" },
  });
  expect(
    await a.mutation(api.Sources.changeGeometry, {
      workspaceId,
      id,
      generation: 1,
      geometry: { ...geometry, x: 999 },
    }),
  ).toBe(false);
  expect((await t.run((ctx) => ctx.db.get(id)))?.revision).toBe(3);
});
test("Web Page cap is separate; deletion frees capacity and Undo waits for a free source slot", async () => {
  const { t, a, workspaceId, auth } = await setup();
  const ids: Id<"sources">[] = [];
  for (let i = 0; i < 20; i++)
    ids.push(
      await a.mutation(api.Sources.request, {
        workspaceId,
        url: `https://example.com/${i}`,
      }),
    );
  expect(await a.query(api.Sources.cards, { workspaceId })).toHaveLength(20);
  await expect(
    a.mutation(api.Sources.request, {
      workspaceId,
      url: "https://example.com/21",
    }),
  ).rejects.toThrow("20");
  expect(
    (
      await a.mutation(api.Canvas.applyHistoryAction, {
        ...auth,
        action: token(),
        attempt: token(),
        input: {
          kind: "create",
          element: { kind: "source", url: "https://example.com/21", geometry },
        },
      })
    ).status,
  ).toBe("blocked");
  await a.mutation(api.Canvas.createDocument, { workspaceId, geometry });
  expect(await a.query(api.Canvas.documentCards, { workspaceId })).toHaveLength(
    1,
  );
  const deletion = await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id: ids[0], generation: 1 },
  });
  const replacement = await a.mutation(api.Sources.request, {
    workspaceId,
    url: "https://example.com/replacement",
  });
  const undo = {
    ...auth,
    action: deletion.action,
    attempt: token(),
    revision: 1,
    undo: true,
  };
  expect((await a.mutation(api.Canvas.reverseHistoryAction, undo)).status).toBe(
    "blocked",
  );
  await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id: replacement, generation: 1 },
  });
  expect(
    (
      await a.mutation(api.Canvas.reverseHistoryAction, {
        ...undo,
        attempt: token(),
      })
    ).status,
  ).toBe("applied");
  expect(await a.query(api.Sources.cards, { workspaceId })).toHaveLength(20);
  expect((await t.run((ctx) => ctx.db.get(ids[0])))?.removed).toBeUndefined();
});
test("mixed document/Web Page geometry is one atomic History action with personal lifecycle continuity", async () => {
  const { a, workspaceId, auth } = await setup();
  const source = await a.mutation(api.Sources.request, {
    workspaceId,
    url: "https://example.com",
    geometry,
  });
  const document = await a.mutation(api.Canvas.createDocument, {
    workspaceId,
    geometry,
  });
  const action = token();
  expect(
    (
      await a.mutation(api.Canvas.updateHistoryGesture, {
        ...auth,
        action,
        sequence: 1,
        updates: [source, document].map((id) => ({
          id,
          generation: 1,
          geometry: { ...geometry, x: 300 },
        })),
      })
    ).status,
  ).toBe("accepted");
  await a.mutation(api.Canvas.closeHistoryGesture, {
    ...auth,
    action,
    attempt: token(),
    sequence: 1,
  });
  const deletion = await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id: source, generation: 1 },
  });
  await a.mutation(api.Canvas.reverseHistoryAction, {
    ...auth,
    action: deletion.action,
    attempt: token(),
    revision: 1,
    undo: true,
  });
  expect(
    (await a.query(api.Canvas.readHistoryAction, { ...auth, action }))
      ?.reversible,
  ).toBe(true);
  expect(
    (
      await a.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action,
        attempt: token(),
        revision: 1,
        undo: true,
      })
    ).status,
  ).toBe("applied");
  expect(
    (await a.query(api.Sources.cards, { workspaceId }))[0].geometry,
  ).toEqual(geometry);
  expect(
    (await a.query(api.Canvas.documentCards, { workspaceId }))[0].geometry,
  ).toEqual(geometry);
});

test("invalid source requests and too-small geometry create no History or source records", async () => {
  const { t, a, workspaceId, auth } = await setup();
  for (const element of [
    { kind: "source" as const, url: "http://127.0.0.1", geometry },
    {
      kind: "source" as const,
      url: "https://example.com",
      geometry: { ...geometry, width: 200 },
    },
  ]) {
    await expect(
      a.mutation(api.Canvas.applyHistoryAction, {
        ...auth,
        action: token(),
        attempt: token(),
        input: { kind: "create", element },
      }),
    ).rejects.toThrow();
  }
  expect(await a.query(api.Sources.cards, { workspaceId })).toEqual([]);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("canvasHistoryActions")
        .withIndex("by_session_action", (q) => q.eq("session", auth.session))
        .take(2),
    ),
  ).toEqual([]);
});

test("Web Page selections can link saved document paragraphs within their workspace", async () => {
  const { a, workspaceId, auth } = await setup();
  const source = await a.mutation(api.Sources.request, {
    workspaceId,
    url: "https://example.com",
  });
  await a.mutation(api.Canvas.createDocument, { workspaceId, geometry });
  const doc = (await a.query(api.Canvas.documentCards, { workspaceId }))[0];
  const paragraphs = await a.query(api.Documents.paragraphs, {
    documentId: doc.documentId,
  });
  const args = {
    workspaceId,
    elementId: source,
    documentId: doc.documentId,
    paragraphId: paragraphs.paragraphs[0].paragraphId,
    version: paragraphs.version,
  };
  await a.mutation(api.Documents.linkParagraph, args);
  expect(await a.query(api.Documents.links, { workspaceId })).toMatchObject([
    { elementId: source, paragraphId: args.paragraphId },
  ]);
  await a.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id: source, generation: 1 },
  });
  await expect(a.mutation(api.Documents.linkParagraph, args)).rejects.toThrow(
    "unavailable",
  );
});
