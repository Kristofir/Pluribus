/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/presence/test";
import { expect, test, vi, afterEach } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
const canvas = { kind: "canvas", id: "shared" } as const;
const guestId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tabId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}
async function join(
  t: ReturnType<typeof setup>,
  args: {
    context:
      | { kind: "canvas"; id: string }
      | {
          kind: "document";
          id: import("./_generated/dataModel").Id<"documents">;
        };
    guestId: string;
    tabId: string;
  },
) {
  const browser = await t.mutation(api.Presence.claimBrowser, {
    secret: crypto.randomUUID().replaceAll("-", "").repeat(2),
    epoch: 1,
    tabId: args.tabId,
    account: null,
  });
  return t.mutation(api.Presence.join, { ...args, browser: browser! });
}
afterEach(() => vi.useRealTimers());
test("anonymous auth users are registered with anonymous presence and visible activity", async () => {
  const t = setup();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      isAnonymous: true,
      name: "Guest fixture",
    }),
  );
  const anonymous = t.withIdentity({ subject: userId });
  const browser = await anonymous.mutation(api.Presence.claimBrowser, {
    secret: "a".repeat(64),
    epoch: 1,
    tabId,
    account: userId,
  });
  const session = await anonymous.mutation(api.Presence.join, {
    context: canvas,
    guestId,
    tabId,
    browser: browser!,
  });
  await anonymous.mutation(api.Presence.publish, {
    context: canvas,
    ...session,
    sequence: 1,
    activity: { kind: "pointer", point: { x: 12, y: 34 } },
  });

  expect(
    await anonymous.query(api.Presence.roster, { context: canvas }),
  ).toMatchObject([{ id: session.id, profile: { kind: "anonymous" } }]);
  expect(
    await anonymous.query(api.Presence.activities, { context: canvas }),
  ).toMatchObject([
    {
      participationId: session.id,
      activity: { kind: "pointer", point: { x: 12, y: 34 } },
    },
  ]);
});
test("capabilities reject wrong context/session and activity channels order independently", async () => {
  const t = setup();
  const session = await join(t, {
    context: canvas,
    guestId,
    tabId,
  });
  const other = await join(t, {
    context: canvas,
    guestId,
    tabId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  });
  const id = await t.run((ctx) =>
    ctx.db.insert("documents", { key: "fixture", access: "public" }),
  );
  const document = { kind: "document", id } as const;
  await expect(
    t.mutation(api.Presence.heartbeat, { ...session, context: document }),
  ).rejects.toThrow("capability");
  await expect(
    t.mutation(api.Presence.leave, {
      ...session,
      id: other.id,
      context: canvas,
    }),
  ).rejects.toThrow("capability");
  const publish = (
    sequence: number,
    activity:
      | { kind: "pointer"; point: { x: number; y: number } | null }
      | { kind: "selection"; elements: string[] },
  ) =>
    t.mutation(api.Presence.publish, {
      ...session,
      context: canvas,
      sequence,
      activity,
    });
  expect(await publish(10, { kind: "pointer", point: { x: 10, y: 20 } })).toBe(
    true,
  );
  expect(await publish(2, { kind: "selection", elements: ["element"] })).toBe(
    true,
  );
  expect(await publish(9, { kind: "pointer", point: { x: 1, y: 1 } })).toBe(
    true,
  );
  await publish(11, { kind: "pointer", point: null });
  expect(await publish(10, { kind: "pointer", point: { x: 1, y: 1 } })).toBe(
    true,
  );
  const rows = await t.query(api.Presence.activities, { context: canvas });
  expect(rows).toHaveLength(2);
  expect(rows.find((r) => r.activity.kind === "pointer")?.activity).toEqual({
    kind: "pointer",
    point: null,
  });
  expect(await t.query(api.Presence.roster, { context: document })).toEqual([]);
  expect(await t.query(api.Presence.roster, { context: canvas })).toHaveLength(
    2,
  );
  await t.mutation(api.Presence.leave, { ...session, context: canvas });
  expect(await t.query(api.Presence.roster, { context: canvas })).toHaveLength(
    1,
  );
  await expect(publish(20, { kind: "pointer", point: null })).rejects.toThrow(
    "capability",
  );
});
test("hidden lifecycle retains activity; malformed payloads and missing documents are rejected", async () => {
  const t = setup();
  const session = await join(t, {
    context: canvas,
    guestId,
    tabId,
  });
  await expect(
    t.mutation(api.Presence.publish, {
      ...session,
      context: canvas,
      sequence: 1,
      activity: { kind: "text", range: { version: 1, anchor: 0, head: 0 } },
    }),
  ).rejects.toThrow("context");
  await expect(
    t.mutation(api.Presence.publish, {
      ...session,
      context: canvas,
      sequence: 1,
      activity: { kind: "pointer", point: { x: NaN, y: 0 } },
    }),
  ).rejects.toThrow("pointer");
  await t.mutation(api.Presence.publish, {
    ...session,
    context: canvas,
    sequence: 1,
    activity: { kind: "selection", elements: ["example"] },
  });
  await t.mutation(api.Presence.lifecycle, {
    ...session,
    context: canvas,
    sequence: 2,
    hidden: true,
    focused: false,
  });
  expect(
    await t.mutation(api.Presence.lifecycle, {
      ...session,
      context: canvas,
      sequence: 1,
      hidden: false,
      focused: true,
    }),
  ).toBe(false);
  expect(
    await t.query(api.Presence.activities, { context: canvas }),
  ).toMatchObject([{ activity: { kind: "selection", elements: ["example"] } }]);
  expect(await t.query(api.Presence.roster, { context: canvas })).toMatchObject(
    [{ hidden: true }],
  );
  const id = await t.run(async (ctx) => {
    const id = await ctx.db.insert("documents", {
      key: "deleted",
      access: "public",
    });
    await ctx.db.delete("documents", id);
    return id;
  });
  await expect(
    t.query(api.Presence.roster, { context: { kind: "document", id } }),
  ).rejects.toThrow("not found");
});
test("two document contexts isolate activity and presence never changes content tables", async () => {
  const t = setup();
  const ids = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("documents", { key: "a", access: "public" }),
      ctx.db.insert("documents", { key: "b", access: "public" }),
    ]),
  );
  const context = { kind: "document", id: ids[0] } as const;
  const session = await join(t, {
    context,
    guestId,
    tabId,
  });
  await t.mutation(api.Presence.publish, {
    ...session,
    context,
    sequence: 1,
    activity: { kind: "text", range: { version: 1, anchor: 1, head: 3 } },
  });
  expect(
    await t.query(api.Presence.activities, {
      context: { kind: "document", id: ids[1] },
    }),
  ).toEqual([]);
  expect(
    await t.run((ctx) => ctx.db.query("documents").withIndex("by_key").take(3)),
  ).toHaveLength(2);
  expect(await t.query(api.Canvas.list, {})).toEqual([]);
});
test("official component expiry removes a participation from the roster and rejects late heartbeats", async () => {
  vi.useFakeTimers();
  const t = setup();
  const session = await join(t, {
    context: canvas,
    guestId,
    tabId,
  });
  expect(await t.query(api.Presence.roster, { context: canvas })).toHaveLength(
    1,
  );
  await vi.advanceTimersByTimeAsync(30_000);
  await t.finishInProgressScheduledFunctions();
  expect(await t.query(api.Presence.roster, { context: canvas })).toHaveLength(
    0,
  );
  expect(
    await t.mutation(api.Presence.heartbeat, { ...session, context: canvas }),
  ).toBe(false);
  expect(
    await t.mutation(api.Presence.publish, {
      ...session,
      context: canvas,
      sequence: 1,
      activity: { kind: "pointer", point: null },
    }),
  ).toBe(false);
});

test("hidden activity remains until authoritative membership expiry", async () => {
  vi.useFakeTimers();
  const t = setup();
  const session = await join(t, {
    context: canvas,
    guestId,
    tabId,
  });
  await t.mutation(api.Presence.publish, {
    context: canvas,
    ...session,
    sequence: 1,
    activity: { kind: "selection", elements: ["example"] },
  });
  await t.mutation(api.Presence.lifecycle, {
    context: canvas,
    ...session,
    sequence: 1,
    hidden: true,
    focused: false,
  });
  expect(
    await t.query(api.Presence.activities, { context: canvas }),
  ).toHaveLength(1);
  expect(
    await t.mutation(api.Presence.publish, {
      context: canvas,
      ...session,
      sequence: 2,
      activity: { kind: "selection", elements: [] },
    }),
  ).toBe(false);
  await vi.advanceTimersByTimeAsync(30_000);
  await t.finishInProgressScheduledFunctions();
  expect(await t.query(api.Presence.activities, { context: canvas })).toEqual(
    [],
  );
});

test("retired rectangle selections are omitted from collaborator activity", async () => {
  const t = setup();
  const rectangle = await t.run((ctx) =>
    ctx.db.insert("rectangles", {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      color: "blue",
    }),
  );
  const session = await join(t, {
    context: canvas,
    guestId,
    tabId,
  });
  await t.mutation(api.Presence.publish, {
    ...session,
    context: canvas,
    sequence: 1,
    activity: { kind: "selection", elements: [rectangle, "active-document"] },
  });
  expect(
    await t.query(api.Presence.activities, { context: canvas }),
  ).toMatchObject([
    { activity: { kind: "selection", elements: ["active-document"] } },
  ]);
});

test("lost acknowledgements retry without duplicate writes or stale clears overwriting a newer drag", async () => {
  const t = setup();
  const session = await join(t, {
    context: canvas,
    guestId,
    tabId,
  });
  const clear = {
    ...session,
    context: canvas,
    sequence: 1,
    activity: { kind: "manipulation" as const, elements: [], operation: null },
  };
  expect(await t.mutation(api.Presence.publish, clear)).toBe(true);
  const first = await t.run((ctx) =>
    ctx.db
      .query("presenceActivity")
      .withIndex("by_participationId_and_channel", (q) =>
        q.eq("participationId", session.id),
      )
      .take(4),
  );
  expect(await t.mutation(api.Presence.publish, clear)).toBe(true);
  const repeated = await t.run((ctx) =>
    ctx.db
      .query("presenceActivity")
      .withIndex("by_participationId_and_channel", (q) =>
        q.eq("participationId", session.id),
      )
      .take(4),
  );
  expect(repeated).toEqual(first);
  const drag = {
    kind: "manipulation" as const,
    elements: ["a"],
    operation: "drag" as const,
  };
  await t.mutation(api.Presence.publish, {
    ...clear,
    sequence: 2,
    activity: drag,
  });
  expect(await t.mutation(api.Presence.publish, clear)).toBe(true);
  expect(await t.query(api.Presence.activities, { context: canvas })).toEqual([
    { participationId: session.id, sequence: 2, activity: drag },
  ]);
});

test("browser handoff fences all old contexts, duplicate joins, claims and delayed leaves", async () => {
  const t = setup();
  const secret = "a".repeat(64);
  const first = (await t.mutation(api.Presence.claimBrowser, {
    secret,
    epoch: 1,
    tabId,
    account: null,
  }))!;
  const old = await t.mutation(api.Presence.join, {
    context: canvas,
    guestId,
    tabId,
    browser: first,
  });
  expect(
    await t.mutation(api.Presence.join, {
      context: canvas,
      guestId,
      tabId,
      browser: first,
    }),
  ).toEqual(old);
  const docId = await t.run((ctx) =>
    ctx.db.insert("documents", { key: "ownership", access: "public" }),
  );
  const document = { kind: "document" as const, id: docId };
  const oldDocument = await t.mutation(api.Presence.join, {
    context: document,
    guestId,
    tabId,
    browser: first,
  });
  await t.mutation(api.Presence.publish, {
    context: canvas,
    ...old,
    sequence: 1,
    activity: { kind: "pointer", point: { x: 1, y: 2 } },
  });
  const nextTab = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const nextArgs = { secret, epoch: 2, tabId: nextTab, account: null };
  const next = (await t.mutation(api.Presence.claimBrowser, nextArgs))!;
  expect(await t.mutation(api.Presence.claimBrowser, nextArgs)).toEqual(next);
  expect(
    await t.mutation(api.Presence.claimBrowser, {
      secret,
      epoch: 1,
      tabId,
      account: null,
    }),
  ).toBeNull();
  expect(await t.query(api.Presence.roster, { context: canvas })).toEqual([]);
  expect(await t.query(api.Presence.activities, { context: canvas })).toEqual(
    [],
  );
  expect(await t.query(api.Presence.roster, { context: document })).toEqual([]);
  await expect(
    t.mutation(api.Presence.join, {
      context: canvas,
      guestId,
      tabId,
      browser: first,
    }),
  ).rejects.toThrow("ownership");
  await expect(
    t.mutation(api.Presence.heartbeat, { context: document, ...oldDocument }),
  ).rejects.toThrow("capability");
  await expect(
    t.mutation(api.Presence.publish, {
      context: canvas,
      ...old,
      sequence: 99,
      activity: { kind: "pointer", point: null },
    }),
  ).rejects.toThrow("capability");
  const live = await t.mutation(api.Presence.join, {
    context: canvas,
    guestId,
    tabId: nextTab,
    browser: next,
  });
  await t.mutation(api.Presence.leave, { context: canvas, ...old });
  await t.mutation(api.Presence.releaseBrowser, { browser: first });
  expect(await t.query(api.Presence.roster, { context: canvas })).toHaveLength(
    1,
  );
  expect(
    await t.mutation(api.Presence.heartbeat, { context: canvas, ...live }),
  ).toBe(true);
  await t.mutation(api.Presence.releaseBrowser, { browser: next });
  await expect(
    t.mutation(api.Presence.join, {
      context: canvas,
      guestId,
      tabId: nextTab,
      browser: next,
    }),
  ).rejects.toThrow("ownership");
  expect(await t.mutation(api.Presence.claimBrowser, nextArgs)).toBeNull();
});

test("browser ownership binds current authentication and does not trust guest IDs", async () => {
  const t = setup();
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", {}),
    await ctx.db.insert("users", {}),
  ]);
  const a = t.withIdentity({ subject: `${userA}|session-a` }),
    b = t.withIdentity({ subject: `${userB}|session-b` });
  const secret = "a".repeat(64);
  const first = (await a.mutation(api.Presence.claimBrowser, {
    secret,
    epoch: 1,
    tabId,
    account: userA,
  }))!;
  await expect(
    b.mutation(api.Presence.claimBrowser, {
      secret,
      epoch: 2,
      tabId,
      account: userA,
    }),
  ).rejects.toThrow("account");
  await expect(
    b.mutation(api.Presence.join, {
      context: canvas,
      guestId,
      tabId,
      browser: first,
    }),
  ).rejects.toThrow("ownership");
  const spoof = (await b.mutation(api.Presence.claimBrowser, {
    secret: "b".repeat(64),
    epoch: 99,
    tabId,
    account: userB,
  }))!;
  expect(spoof.id).not.toBe(first.id);
  const next = (await b.mutation(api.Presence.claimBrowser, {
    secret,
    epoch: 2,
    tabId,
    account: userB,
  }))!;
  await expect(
    a.mutation(api.Presence.join, {
      context: canvas,
      guestId,
      tabId,
      browser: first,
    }),
  ).rejects.toThrow("ownership");
  await expect(
    a.mutation(api.Presence.join, {
      context: canvas,
      guestId,
      tabId,
      browser: next,
    }),
  ).rejects.toThrow("ownership");
  // Old clients cannot join without ownership even though they know a display ID.
  await expect(
    t.mutation(api.Presence.join, { context: canvas, guestId, tabId } as never),
  ).rejects.toThrow();
});
