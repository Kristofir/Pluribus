/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { sourceDeadlineMs } from "@pluribus/core/sources/domain";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const { userId, workspaceId, other } = await t.run(async (ctx) => ({
    userId: await ctx.db.insert("users", {}),
    workspaceId: await ctx.db.insert("workspaces", {
      name: "Test",
      slug: "test",
    }),
    other: await ctx.db.insert("workspaces", { name: "Other", slug: "other" }),
  }));
  await t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId, userId }),
  );
  const a = t.withIdentity({ subject: userId });
  const request = { workspaceId, url: "https://example.com" };
  const id = await a.mutation(api.Sources.request, request);
  const refresh = { ...request, sourceId: id };
  return { t, a, request, refresh, id, workspaceId, other };
}

test.each(["queued", "fetching"] as const)(
  "expiry recovers stranded %s and never retries provider work",
  async (status) => {
    const { t, a, id, workspaceId } = await setup();
    if (status === "fetching")
      await t.mutation(internal.sources.Jobs.begin, { id, revision: 1 });
    const before = await a.query(api.Sources.get, { workspaceId, id });
    expect(before?.deadlineAt).toBe(Date.now() + sourceDeadlineMs);
    expect(
      await t.mutation(internal.sources.Jobs.expire, { id, revision: 1 }),
    ).toBe(false);
    vi.setSystemTime(Date.now() + sourceDeadlineMs);
    expect(
      await t.mutation(internal.sources.Jobs.expire, { id, revision: 1 }),
    ).toBe(true);
    expect(
      await t.mutation(internal.sources.Jobs.expire, { id, revision: 1 }),
    ).toBe(false);
    expect(await a.query(api.Sources.get, { workspaceId, id })).toMatchObject({
      status: "failed",
      revision: 1,
    });
    expect(
      await t.mutation(internal.sources.Jobs.begin, { id, revision: 1 }),
    ).toBeNull();
  },
);

test("deadline is enforced even when expiry has not run; stale expiry cannot fail a new capture", async () => {
  const { t, a, id, refresh, workspaceId } = await setup();
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 1 });
  vi.setSystemTime(Date.now() + sourceDeadlineMs);
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    capture: { id: "late", capturedAt: 1, content: "Late" },
  });
  expect(await a.query(api.Sources.get, { workspaceId, id })).toMatchObject({
    status: "failed",
  });
  expect(
    (await a.query(api.Sources.get, { workspaceId, id }))?.capture,
  ).toBeUndefined();
  await a.mutation(api.Sources.request, refresh);
  expect(
    await t.mutation(internal.sources.Jobs.expire, { id, revision: 1 }),
  ).toBe(false);
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 2 });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 2,
    capture: { id: "good", capturedAt: 2, content: "Good" },
  });
  vi.setSystemTime(Date.now() + sourceDeadlineMs);
  expect(
    await t.mutation(internal.sources.Jobs.expire, { id, revision: 2 }),
  ).toBe(false);
  expect(await a.query(api.Sources.get, { workspaceId, id })).toMatchObject({
    status: "ready",
    capture: { content: "Good" },
  });
});

test("scheduled expiry is installed alongside capture work", async () => {
  const { t, id } = await setup();
  // Cancel only the provider task to simulate work that never begins, then let
  // the real scheduled recovery mutation execute under the fake clock.
  await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    const fetchJob = jobs.find(
      (job) => job.name.includes("Jobs") && job.name.endsWith(":fetch"),
    );
    expect(fetchJob).toBeDefined();
    await ctx.scheduler.cancel(fetchJob!._id);
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("failed");
});

test("recover is authorized, revision-scoped and supports legacy jobs without deadlines", async () => {
  const { t, a, id, workspaceId, other } = await setup();
  const args = { workspaceId, id, revision: 1 };
  await expect(t.mutation(api.Sources.recover, args)).rejects.toThrow(
    "access denied",
  );
  await expect(
    a.mutation(api.Sources.recover, { ...args, workspaceId: other }),
  ).rejects.toThrow("access denied");
  expect(await a.mutation(api.Sources.recover, args)).toBe(false);
  await t.run((ctx) =>
    ctx.db.patch(id, { deadlineAt: undefined, status: "fetching" }),
  );
  expect(await a.mutation(api.Sources.recover, { ...args, revision: 0 })).toBe(
    false,
  );
  expect(await a.mutation(api.Sources.recover, args)).toBe(true);
  expect(await a.mutation(api.Sources.recover, args)).toBe(false);
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    capture: { id: "late", capturedAt: 1, content: "Late" },
  });
  expect((await t.run((ctx) => ctx.db.get(id)))?.capture).toBeUndefined();
});

test("identical requests coalesce; changing an active request requires explicit current revision", async () => {
  const { t, a, id, refresh } = await setup();
  await Promise.all([
    a.mutation(api.Sources.request, refresh),
    a.mutation(api.Sources.request, refresh),
  ]);
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 1 });
  expect(await a.mutation(api.Sources.request, refresh)).toBe(id);
  const changed = { ...refresh, prompt: "New extraction" };
  await expect(a.mutation(api.Sources.request, changed)).rejects.toThrow(
    "SOURCE_REQUEST_ACTIVE",
  );
  await expect(
    a.mutation(api.Sources.request, { ...changed, replaceActive: true }),
  ).rejects.toThrow("SOURCE_REQUEST_ACTIVE");
  await expect(
    a.mutation(api.Sources.request, {
      ...changed,
      replaceActive: true,
      expectedRevision: 0,
    }),
  ).rejects.toThrow("SOURCE_REVISION_CONFLICT");
  await a.mutation(api.Sources.request, {
    ...changed,
    replaceActive: true,
    expectedRevision: 1,
  });
  // A lost acknowledgement replay of the replacement coalesces with its own work.
  await a.mutation(api.Sources.request, {
    ...changed,
    replaceActive: true,
    expectedRevision: 1,
  });
  expect((await t.run((ctx) => ctx.db.get(id)))?.revision).toBe(2);
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    capture: { id: "stale", capturedAt: 1, content: "Stale" },
  });
  expect((await t.run((ctx) => ctx.db.get(id)))?.capture).toBeUndefined();
  await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    expect(jobs).toHaveLength(4); // one fetch + expiry per accepted revision
  });
});

test("failed prompted refreshes preserve an intentionally unprompted capture", async () => {
  const { t, a, id, refresh } = await setup();
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 1 });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    capture: { id: "original", capturedAt: 1, content: "Original" },
  });
  const original = (await t.run((ctx) => ctx.db.get(id)))!.capture;
  await a.mutation(api.Sources.request, { ...refresh, prompt: "New prompt" });
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 2 });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 2,
    error: "Failed",
  });
  await a.mutation(api.Sources.request, refresh);
  expect((await t.run((ctx) => ctx.db.get(id)))?.capture).toEqual(original);
});

test.each([
  { data: {}, prompt: undefined },
  { data: { markdown: "  " }, prompt: undefined },
  { data: { markdown: "Page" }, prompt: "Extract" },
  { data: { markdown: "Page", json: null }, prompt: "Extract" },
  { data: { markdown: "Page", json: "bad" }, prompt: "Extract" },
])(
  "incomplete provider success retains the last capture: %j",
  async ({ data, prompt }) => {
    const { t, a, id, refresh } = await setup();
    await t.mutation(internal.sources.Jobs.begin, { id, revision: 1 });
    await t.mutation(internal.sources.Jobs.complete, {
      id,
      revision: 1,
      capture: { id: "original", capturedAt: 1, content: "Original" },
    });
    const original = (await t.run((ctx) => ctx.db.get(id)))!.capture;
    await a.mutation(api.Sources.request, { ...refresh, prompt });
    vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: true, data })),
        ),
    );
    await t.action(internal.sources.Jobs.fetch, { id, revision: 2 });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.status).toBe("failed");
    expect(row?.error).toContain("invalid response");
    expect(row?.capture).toEqual(original);
  },
);

test("table request identity, validation and provenance survive refresh and clearing", async () => {
  const { t, a, id, refresh, workspaceId } = await setup();
  const table = { columns: ["Name"] };
  await expect(
    a.mutation(api.Sources.request, {
      ...refresh,
      prompt: "Return as CSV table",
      table: { columns: ["Name"] },
      expectedRevision: 1,
      replaceActive: true,
    }),
  ).rejects.toThrow("SOURCE_EXTRACTION_INTENT_REQUIRED");
  expect((await a.query(api.Sources.get, { workspaceId, id }))?.revision).toBe(
    1,
  );
  await a.mutation(api.Sources.request, {
    ...refresh,
    prompt: "Extract names",
    table: { columns: [" Name "] },
    expectedRevision: 1,
    replaceActive: true,
  });
  await a.mutation(api.Sources.request, {
    ...refresh,
    prompt: "Extract names",
    table,
    expectedRevision: 1,
  });
  expect((await a.query(api.Sources.get, { workspaceId, id }))?.revision).toBe(
    2,
  );
  await expect(
    a.mutation(api.Sources.request, {
      ...refresh,
      table: { columns: ["Other"] },
    }),
  ).rejects.toThrow("SOURCE_REQUEST_ACTIVE");
  await expect(
    a.mutation(api.Sources.request, {
      ...refresh,
      table: { columns: ["Name", "name"] },
      expectedRevision: 2,
      replaceActive: true,
    }),
  ).rejects.toThrow("unique column");
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 2 });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 2,
    capture: {
      id: "table",
      content: "Page",
      data: '{"rows":[]}',
      capturedAt: 1,
    },
  });
  const captured = await a.query(api.Sources.get, { workspaceId, id });
  expect(captured?.capture?.table).toEqual(table);
  expect(
    (await a.query(api.Sources.cards, { workspaceId }))[0]?.capture?.table,
  ).toEqual(table);
  await a.mutation(api.Sources.request, { ...refresh, expectedRevision: 2 });
  expect((await a.query(api.Sources.get, { workspaceId, id }))?.table).toEqual(
    table,
  );
  await a.mutation(api.Sources.request, {
    ...refresh,
    prompt: "",
    table: null,
    expectedRevision: 3,
    replaceActive: true,
  });
  const cleared = await a.query(api.Sources.get, { workspaceId, id });
  expect(cleared?.table).toBeUndefined();
  expect(cleared?.capture).toEqual(captured?.capture);
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 3,
    capture: { id: "stale", content: "Stale", capturedAt: 2 },
  });
  expect(
    (await a.query(api.Sources.get, { workspaceId, id }))?.capture,
  ).toEqual(captured?.capture);
});

test("invalid provider table retains the prior capture and its extraction provenance", async () => {
  const { t, a, id, refresh, workspaceId } = await setup();
  const previous = {
    id: "plain",
    content: "Saved page",
    capturedAt: 1,
    url: refresh.url,
  };
  await t.run((ctx) =>
    ctx.db.patch(id, { capture: previous, status: "ready" }),
  );
  await a.mutation(api.Sources.request, {
    ...refresh,
    prompt: "Extract names",
    table: { columns: ["Name"] },
    expectedRevision: 1,
  });
  vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            markdown: "Page",
            json: { requestType: "CSV", schemaProvided: true },
          },
        }),
      ),
    ),
  );
  await t.action(internal.sources.Jobs.fetch, { id, revision: 2 });
  const result = await a.query(api.Sources.get, { workspaceId, id });
  expect(result?.status).toBe("failed");
  expect(result?.error).toContain("matching the requested columns");
  expect(result?.capture).toEqual(previous);
  expect(result?.deadlineAt).toBeUndefined();
});

test("inferred output marker persists with capture provenance and survives failed refresh", async () => {
  const { t, a, id, refresh, workspaceId } = await setup();
  await a.mutation(api.Sources.request, {
    ...refresh,
    prompt: "Return as CSV table",
    expectedRevision: 1,
    replaceActive: true,
  });
  const json = {
    kind: "table",
    text: "",
    columns: ["Name"],
    rows: [["Example"]],
  };
  vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: { markdown: "Page", json } }),
        ),
      ),
  );
  await t.action(internal.sources.Jobs.fetch, { id, revision: 2 });
  const first = await a.query(api.Sources.get, { workspaceId, id });
  expect(first?.status).toBe("ready");
  expect(first?.capture).toMatchObject({
    extractionFormat: "inferred-v1",
    prompt: "Return as CSV table",
    data: JSON.stringify(json),
  });
  expect(first?.capture?.table).toBeUndefined();
  expect(
    (await a.query(api.Sources.cards, { workspaceId }))[0]?.capture
      ?.extractionFormat,
  ).toBe("inferred-v1");
  await a.mutation(api.Sources.request, {
    ...refresh,
    prompt: "Summarize the article",
    expectedRevision: 2,
  });
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        success: true,
        data: { markdown: "Page", json: { requestType: "summary" } },
      }),
    ),
  );
  await t.action(internal.sources.Jobs.fetch, { id, revision: 3 });
  const failed = await a.query(api.Sources.get, { workspaceId, id });
  expect(failed?.status).toBe("failed");
  expect(failed?.error).toContain("invalid extraction");
  expect(failed?.capture).toEqual(first?.capture);
});
