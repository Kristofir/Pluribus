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
afterEach(() => vi.useRealTimers());
test("capabilities reject wrong context/session and activity channels order independently", async () => {
  const t = setup();
  const session = await t.mutation(api.Presence.join, {
    context: canvas,
    guestId,
    tabId,
  });
  const other = await t.mutation(api.Presence.join, {
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
    false,
  );
  await publish(11, { kind: "pointer", point: null });
  expect(await publish(10, { kind: "pointer", point: { x: 1, y: 1 } })).toBe(
    false,
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
  const session = await t.mutation(api.Presence.join, {
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
  const session = await t.mutation(api.Presence.join, {
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
  const session = await t.mutation(api.Presence.join, {
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
  const session = await t.mutation(api.Presence.join, {
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
  const session = await t.mutation(api.Presence.join, {
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
