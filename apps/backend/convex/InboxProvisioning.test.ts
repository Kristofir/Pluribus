/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test, vi, afterEach } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
test("workspace creation skips inbox provisioning; explicit legacy recovery retains provider identity", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  register(t);
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "setup", name: "Setup", assignments: [] },
  );
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  await t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId, userId }),
  );
  const a = t.withIdentity({ subject: userId });
  const state = () =>
    t.run((ctx) =>
      ctx.db
        .query("workspaceInboxProvisioning")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .unique(),
    );
  expect(await state()).toBeNull();
  await t.mutation(internal.inbox.Provisioning.ensure, { workspaceId });
  const first = (await state())!;
  expect(first.status).toBe("pending");
  await a.mutation(internal.Inbox.retryProvisioning, { workspaceId });
  expect(await state()).toEqual(first);
  expect(
    await t.mutation(internal.inbox.Provisioning.begin, {
      id: first._id,
      revision: 1,
    }),
  ).toBe(first.clientId);
  await t.mutation(internal.inbox.Provisioning.expire, {
    id: first._id,
    revision: 1,
  });
  expect(
    (await a.query(internal.Inbox.list, { workspaceId })).provisioning?.status,
  ).toBe("failed");
  await expect(
    t.mutation(internal.Inbox.retryProvisioning, { workspaceId }),
  ).rejects.toThrow("access denied");
  await a.mutation(internal.Inbox.retryProvisioning, { workspaceId });
  const retry = (await state())!;
  expect(retry.clientId).toBe(first.clientId);
  expect(retry.revision).toBe(2);
  await t.mutation(internal.inbox.Provisioning.complete, {
    id: first._id,
    revision: 1,
    providerInboxId: "stale-provider",
  });
  await t.mutation(internal.inbox.Provisioning.expire, {
    id: first._id,
    revision: 1,
  });
  expect((await state())?.status).toBe("pending");
  expect(
    await t.mutation(internal.inbox.Provisioning.begin, {
      id: first._id,
      revision: 2,
    }),
  ).toBe(first.clientId);
  await t.mutation(internal.inbox.Provisioning.complete, {
    id: first._id,
    revision: 2,
    providerInboxId: "same-provider",
  });
  await a.mutation(internal.Inbox.retryProvisioning, { workspaceId });
  expect((await state())?.status).toBe("ready");
  expect(
    (await a.query(internal.Inbox.list, { workspaceId })).provisioning?.status,
  ).toBe("ready");
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("workspaceInboxes")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .take(2),
    ),
  ).toHaveLength(1);
  expect(
    (await a.query(internal.Inbox.list, { workspaceId })).address,
  ).toBeNull();
  await t.run(async (ctx) => {
    const bound = await ctx.db
      .query("workspaceInboxes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    await ctx.db.patch(bound!._id, { providerInboxId: "demo@example.test" });
  });
  expect((await a.query(internal.Inbox.list, { workspaceId })).address).toBe(
    "demo@example.test",
  );
  await expect(t.query(internal.Inbox.list, { workspaceId })).rejects.toThrow(
    "access denied",
  );
});
test("lost provider response retries the same client_id and never requests email delivery", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  register(t);
  vi.stubEnv("AGENTMAIL_API_KEY", "test-only-key");
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "lost", name: "Lost response", assignments: [] },
  );
  await t.mutation(internal.inbox.Provisioning.ensure, { workspaceId });
  const row = (await t.run((ctx) =>
    ctx.db
      .query("workspaceInboxProvisioning")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique(),
  ))!;
  const requests: { url: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, body: String(init.body) });
      if (requests.length === 1)
        throw new Error("Response lost after provider accepted");
      return Response.json({ inbox_id: "replayed-provider-id" });
    }),
  );
  await t.action(internal.inbox.Provisioning.create, {
    id: row._id,
    revision: 1,
  });
  await t.mutation(internal.inbox.Provisioning.ensure, { workspaceId });
  await t.action(internal.inbox.Provisioning.create, {
    id: row._id,
    revision: 2,
  });
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(JSON.parse(requests[0].body)).toEqual({ client_id: row.clientId });
  expect(requests[0].url).toBe("https://api.agentmail.to/v0/inboxes");
  expect((await t.run((ctx) => ctx.db.get(row._id)))?.status).toBe("ready");
});
