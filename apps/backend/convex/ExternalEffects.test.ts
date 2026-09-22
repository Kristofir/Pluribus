/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test, vi, afterEach } from "vitest";
import { deliverIntent } from "@pluribus/core/inbox/delivery";
import { publicSourceUrl } from "./sources/Firecrawl";
import { api, internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const t = convexTest(schema, modules);
  register(t);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "effects", name: "Effects", assignments: [] },
  );
  await t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId, userId }),
  );
  const a = t.withIdentity({ subject: userId });
  return { t, a, workspaceId, userId };
}
test("stale source result cannot replace refreshed capture; private/literal destinations refuse", async () => {
  const { t, a, workspaceId } = await setup();
  const id = await a.mutation(api.Sources.request, {
    workspaceId,
    url: "https://example.com",
  });
  expect(
    await t.mutation(internal.sources.Jobs.begin, { id, revision: 1 }),
  ).toEqual({ url: "https://example.com/" });
  await a.mutation(api.Sources.request, {
    workspaceId,
    sourceId: id,
    url: "https://example.com/new",
    expectedRevision: 1,
    replaceActive: true,
  });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    capture: { id: "old", capturedAt: 1, content: "Old" },
  });
  expect(
    (await a.query(api.Sources.list, { workspaceId }))[0].capture,
  ).toBeUndefined();
  await t.mutation(internal.sources.Jobs.begin, { id, revision: 2 });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 2,
    capture: { id: "new", capturedAt: 2, content: "New" },
  });
  await t.mutation(internal.sources.Jobs.complete, {
    id,
    revision: 1,
    error: "Old failure",
  });
  expect(
    (await a.query(api.Sources.list, { workspaceId }))[0].capture?.content,
  ).toBe("New");
  await a.mutation(api.Sources.request, {
    workspaceId,
    sourceId: id,
    url: "https://example.com/third",
    prompt: "New extraction",
  });
  expect(
    (await a.query(api.Sources.list, { workspaceId }))[0].capture,
  ).toMatchObject({ content: "New", url: "https://example.com/new" });
  for (const url of [
    "http://127.0.0.1",
    "http://2130706433",
    "http://[::1]",
    "https://host.local",
    "file:///etc/passwd",
    "https://user:password@example.com",
  ])
    expect(() => publicSourceUrl(url)).toThrow();
  await expect(t.query(api.Sources.list, { workspaceId })).rejects.toThrow(
    "access denied",
  );
});
test("inbox projection preserves one canonical draft and stale reads cannot overwrite messages", async () => {
  const { t, a, workspaceId, userId } = await setup();
  const inboxId = await t.run((ctx) =>
    ctx.db.insert("workspaceInboxes", {
      workspaceId,
      providerInboxId: "fixture-inbox",
      revision: 2,
      status: "loading",
    }),
  );
  const threads = [
    {
      providerId: "thread",
      subject: "Subject",
      messages: [
        {
          id: "message",
          from: "sender@example.test",
          direction: "incoming" as const,
          to: ["inbox@example.test"],
          text: "Incoming",
        },
      ],
      truncated: false,
    },
  ];
  await t.mutation(internal.inbox.Jobs.complete, {
    inboxId,
    revision: 2,
    userId,
    threads,
  });
  const thread = (await a.query(api.Inbox.list, { workspaceId })).threads[0];
  const doc = await a.mutation(api.Inbox.draft, { threadId: thread.id });
  expect(await a.mutation(api.Inbox.draft, { threadId: thread.id })).toBe(doc);
  await t.mutation(internal.inbox.Jobs.complete, {
    inboxId,
    revision: 1,
    userId,
    threads: [{ ...threads[0], subject: "Stale" }],
  });
  expect(
    (await a.query(api.Inbox.list, { workspaceId })).threads[0].subject,
  ).toBe("Subject");
  await t.run((ctx) =>
    ctx.db.patch(thread.id, {
      messages: [
        {
          ...threads[0].messages[0],
          replyTo: ["Reply Person <reply@example.test>"],
        },
        {
          id: "sent",
          from: "inbox@example.test",
          to: ["sender@example.test"],
          direction: "outgoing",
          text: "Our last reply",
        },
      ],
    }),
  );
  expect(
    await a.query(api.Inbox.review, { threadId: thread.id }),
  ).toMatchObject({
    reviewedMessageId: "message",
    recipients: ["reply@example.test"],
  });
  expect(
    (await a.query(api.Documents.describe, { documentId: doc })).role,
  ).toBe("reply");
  expect(await a.query(api.Canvas.documentCards, { workspaceId })).toEqual([]);
  await expect(
    t.query(api.Inbox.review, { threadId: thread.id }),
  ).rejects.toThrow("access denied");
});
test("send freezes reviewed version and recipients, dispatch claims once, timeout cannot resend", async () => {
  const { t, a, workspaceId, userId } = await setup();
  const inboxId = await t.run((ctx) =>
    ctx.db.insert("workspaceInboxes", {
      workspaceId,
      providerInboxId: "fixture-inbox",
      revision: 0,
      status: "ready",
    }),
  );
  const threadId = await t.run((ctx) =>
    ctx.db.insert("inboxThreads", {
      workspaceId,
      inboxId,
      providerId: "thread",
      subject: "Subject",
      messages: [
        {
          id: "msg",
          from: "sender@example.test",
          direction: "incoming" as const,
          to: [],
          text: "Incoming",
        },
      ],
      truncated: false,
    }),
  );
  const documentId = await a.mutation(api.Inbox.draft, { threadId });
  await a.mutation(api.Documents.submitSteps, {
    id: `${documentId}:1`,
    version: 1,
    clientId: "human",
    steps: [
      JSON.stringify({
        stepType: "replace",
        from: 1,
        to: 1,
        slice: { content: [{ type: "text", text: "Reviewed reply" }] },
      }),
    ],
  });
  const review = await a.query(api.Inbox.review, { threadId });
  const request = {
    threadId,
    requestId: crypto.randomUUID(),
    reviewedMessageId: review.reviewedMessageId!,
    draftVersion: review.version,
    text: review.text,
    recipients: review.recipients,
  };
  await expect(
    a.mutation(api.Inbox.send, { ...request, text: "Unreviewed text" }),
  ).rejects.toThrow("Draft changed");
  await t.run(async (ctx) => {
    const thread = await ctx.db.get(threadId);
    await ctx.db.patch(threadId, {
      messages: [
        ...thread!.messages,
        {
          id: "new-received",
          from: "sender@example.test",
          to: [],
          direction: "incoming",
          text: "Another message",
        },
      ],
    });
  });
  await expect(a.mutation(api.Inbox.send, request)).rejects.toThrow(
    "Reply target changed",
  );
  await t.run(async (ctx) => {
    const thread = await ctx.db.get(threadId);
    await ctx.db.patch(threadId, { messages: thread!.messages.slice(0, -1) });
  });
  const intentId = await a.mutation(api.Inbox.send, request);
  expect(await a.mutation(api.Inbox.send, request)).toBe(intentId);
  expect(
    await a.query(api.Inbox.submission, {
      threadId,
      requestId: request.requestId,
    }),
  ).toMatchObject({ intentId, status: "pending" });
  expect(
    await a.query(api.Inbox.submission, {
      threadId,
      requestId: "not-submitted",
    }),
  ).toBeNull();
  await expect(
    t.query(api.Inbox.submission, { threadId, requestId: request.requestId }),
  ).rejects.toThrow("access denied");

  vi.stubEnv("AGENTMAIL_API_KEY", "test-only-not-a-live-key");
  const claimed = await t.mutation(internal.inbox.Sends.claim, { intentId });
  expect(claimed?.text).toBe("Reviewed reply");
  expect(claimed?.recipients).toEqual(["sender@example.test"]);
  expect(await t.mutation(internal.inbox.Sends.claim, { intentId })).toBeNull();
  await t.mutation(internal.inbox.Sends.expire, { intentId });
  expect((await a.query(api.Inbox.delivery, { threadId }))?.status).toBe(
    "unknown",
  );
  await expect(
    a.mutation(api.Inbox.send, { ...request, requestId: crypto.randomUUID() }),
  ).rejects.toThrow("existing delivery");
  await a.mutation(api.Inbox.reconcile, { threadId });
  expect(
    await t.query(internal.inbox.Reconciliation.request, {
      intentId,
      userId,
      revision: 1,
    }),
  ).toMatchObject({ intentId: String(intentId) });
  await t.mutation(internal.inbox.Reconciliation.complete, {
    intentId,
    revision: 1,
    messageId: null,
    failed: false,
  });
  expect((await a.query(api.Inbox.delivery, { threadId }))?.status).toBe(
    "unknown",
  );
  await expect(
    a.mutation(api.Inbox.send, { ...request, requestId: crypto.randomUUID() }),
  ).rejects.toThrow("existing delivery");
  await a.mutation(api.Inbox.reconcile, { threadId });
  await t.mutation(internal.inbox.Reconciliation.expire, {
    intentId,
    revision: 2,
  });
  expect((await t.run((ctx) => ctx.db.get(intentId)))?.reconciling).toBe(false);
  await a.mutation(api.Inbox.reconcile, { threadId });
  await t.mutation(internal.inbox.Reconciliation.expire, {
    intentId,
    revision: 2,
  });
  await t.mutation(internal.inbox.Reconciliation.complete, {
    intentId,
    revision: 2,
    messageId: null,
    failed: true,
  });
  expect((await t.run((ctx) => ctx.db.get(intentId)))?.reconciling).toBe(true);
  await t.mutation(internal.inbox.Reconciliation.complete, {
    intentId,
    revision: 3,
    messageId: "provider-ack",
    failed: false,
  });
  expect((await a.query(api.Inbox.delivery, { threadId }))?.status).toBe(
    "sent",
  );
  const second = await a.mutation(api.Inbox.send, {
    ...request,
    requestId: crypto.randomUUID(),
  });
  await t.run(async (ctx) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId),
      )
      .unique();
    await ctx.db.delete(member!._id);
  });
  expect(
    await t.mutation(internal.inbox.Sends.claim, { intentId: second }),
  ).toBeNull();
  expect(await t.run((ctx) => ctx.db.get(second))).toMatchObject({
    status: "failed",
    error: "Workspace access changed before dispatch",
  });
});
test("delivery service reports fake success and uncertainty without retrying provider calls", async () => {
  const send = vi.fn(async () => ({ messageId: "accepted" })),
    finish = vi.fn(async () => {});
  await deliverIntent({ claim: async () => ({ text: "fixed" }), send, finish });
  expect(send).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledWith({
    status: "sent",
    messageId: "accepted",
  });
  const uncertain = vi.fn(async () => {
    throw new Error("lost reply");
  });
  await deliverIntent({
    claim: async () => ({ text: "fixed" }),
    send: uncertain,
    finish,
  });
  expect(uncertain).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "unknown" }),
  );
  await deliverIntent({ claim: async () => null, send, finish });
  expect(send).toHaveBeenCalledTimes(1);
});

test("provider HTTP adapters preserve reply metadata and require exact sent-message evidence", async () => {
  const { readInbox, findSentIntent } = await import("./inbox/AgentMail");
  vi.stubEnv("AGENTMAIL_API_KEY", "test-only-not-a-live-key");
  const responses = [
    { threads: [{ thread_id: "thread" }] },
    {
      subject: "Subject",
      messages: [
        {
          message_id: "received",
          from: "Sender <sender@example.test>",
          reply_to: ["Reply <reply@example.test>"],
          labels: ["received"],
          text: "Incoming",
        },
        {
          message_id: "sent",
          from: "inbox@example.test",
          labels: ["sent"],
          text: "Outgoing",
        },
      ],
    },
    {
      messages: [
        { message_id: "wrong", labels: ["sent"] },
        { message_id: "right", labels: ["sent"] },
      ],
    },
    { headers: { "X-Pluribus-Intent": "different-intent" } },
    { headers: { "x-pluribus-intent": "expected-intent" } },
    { messages: [{ message_id: "received", labels: ["received"] }] },
  ];
  const fetchMock = vi.fn(async () => Response.json(responses.shift()));
  vi.stubGlobal("fetch", fetchMock);
  try {
    const inbox = await readInbox("fixture-inbox");
    expect(inbox[0].messages[0]).toMatchObject({
      direction: "incoming",
      replyTo: ["Reply <reply@example.test>"],
    });
    expect(inbox[0].messages[1].direction).toBe("outgoing");
    expect(
      await findSentIntent({
        inboxId: "fixture-inbox",
        threadId: "thread",
        intentId: "expected-intent",
      }),
    ).toBe("right");
    expect(
      await findSentIntent({
        inboxId: "fixture-inbox",
        threadId: "thread",
        intentId: "expected-intent",
      }),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    for (const [url, options] of fetchMock.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(
        url.startsWith("https://api.agentmail.to/v0/inboxes/fixture-inbox/"),
      ).toBe(true);
      expect(options.method ?? "GET").toBe("GET");
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
