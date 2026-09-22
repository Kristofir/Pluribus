/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { downloadScreenshot, screenshotFormat } from "./sources/Screenshot";
const modules = import.meta.glob("./**/*.ts");
const assetUrl =
  "https://storage.googleapis.com/provider-assets/viewport.png?signature=private";
function png(height = 800) {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x89504e47);
  view.setUint32(4, 0x0d0a1a0a);
  view.setUint32(12, 0x49484452);
  view.setUint32(16, 1280);
  view.setUint32(20, height);
  return bytes;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test("requests above-fold screenshot and downloads bounded raster without credentials", async () => {
  expect(screenshotFormat).toMatchObject({
    fullPage: false,
    viewport: { width: 1280, height: 800 },
  });
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(png(), { headers: { "content-type": "image/png" } }),
    );
  vi.stubGlobal("fetch", fetch);
  expect((await downloadScreenshot(assetUrl)).type).toBe("image/png");
  expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  expect(fetch.mock.calls[0][1].headers).toBeUndefined();
});
test.each([
  "http://storage.googleapis.com/image",
  "https://localhost/image",
  "https://127.0.0.1/image",
  "https://storage.googleapis.com.evil.example/image",
  "https://example.com/image",
])("rejects screenshot host %s before fetching", async (url) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(downloadScreenshot(url)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
test.each([
  [png(4000), "image/png"],
  [new Uint8Array(24), "image/png"],
  [png(), "text/html"],
  [png(), "image/svg+xml"],
  [new Uint8Array(5 * 1024 * 1024 + 1), "image/png"],
])(
  "rejects full page, invalid, non-raster or oversized image %#",
  async (bytes, type) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array(bytes as Uint8Array), {
          headers: { "content-type": type as string },
        }),
      ),
    );
    await expect(downloadScreenshot(assetUrl)).rejects.toThrow();
  },
);
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Test",
      slug: "test",
    });
    await ctx.db.insert("workspaceMembers", { userId, workspaceId });
    const id = await ctx.db.insert("sources", {
      workspaceId,
      userId,
      url: "https://example.com/",
      status: "queued",
      revision: 1,
    });
    return { id, workspaceId, userId };
  });
  return { t, ...ids, a: t.withIdentity({ subject: ids.userId }) };
}
test("durable screenshot belongs to capture; missing screenshot accepts text; old accepted asset remains", async () => {
  const { t, a, id, workspaceId } = await setup();
  vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { markdown: "Page", screenshot: assetUrl },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(png(), { headers: { "content-type": "image/png" } }),
      ),
  );
  await t.action(internal.sources.Jobs.fetch, { id, revision: 1 });
  const first = await a.query(api.Sources.get, { workspaceId, id });
  expect(first?.capture?.screenshot).toMatchObject({
    url: expect.any(String),
    width: 1280,
    height: 800,
  });
  expect(JSON.stringify(first)).not.toContain("signature=private");
  const old = await t.run(
    async (ctx) => (await ctx.db.get(id))!.capture!.screenshot!.storageId,
  );
  await t.run((ctx) => ctx.db.patch(id, { revision: 2, status: "queued" }));
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response("failed", { status: 500 }),
  );
  await t.action(internal.sources.Jobs.fetch, { id, revision: 2 });
  expect(
    (await a.query(api.Sources.get, { workspaceId, id }))?.capture,
  ).toEqual(first?.capture);
  await t.run((ctx) => ctx.db.patch(id, { removed: true }));
  expect(await a.query(api.Sources.get, { workspaceId, id })).toBeNull();
  await t.run((ctx) =>
    ctx.db.patch(id, { removed: undefined, revision: 3, status: "queued" }),
  );
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({ success: true, data: { markdown: "New page" } }),
    ),
  );
  await t.action(internal.sources.Jobs.fetch, { id, revision: 3 });
  const second = await a.query(api.Sources.get, { workspaceId, id });
  expect(second?.status).toBe("ready");
  expect(second?.capture?.screenshot).toBeUndefined();
  expect(second?.capture?.screenshotError).toContain("unavailable");
  await t.mutation(internal.sources.Jobs.cleanupScreenshot, { storageId: old });
  expect(await t.run((ctx) => ctx.storage.getUrl(old))).not.toBeNull();
  // Replaying an old successful completion must not delete a snapshotted asset.
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    capture: {
      id: "old",
      content: "Old",
      capturedAt: 1,
      screenshot: { storageId: old, width: 1280, height: 800 },
    },
  });
  expect(await t.run((ctx) => ctx.storage.getUrl(old))).not.toBeNull();
});
test("stale or deleted completion deletes only its pending upload", async () => {
  const { t, id } = await setup();
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob([png()], { type: "image/png" })),
  );
  await t.mutation(internal.sources.Jobs.registerScreenshot, { storageId });
  await t.run((ctx) => ctx.db.patch(id, { removed: true, revision: 2 }));
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    capture: {
      id: "stale",
      content: "Page",
      capturedAt: 1,
      screenshot: { storageId, width: 1280, height: 800 },
    },
  });
  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
});
