/// <reference types="vite/client" />
import { register as registerPresence } from "@convex-dev/presence/test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

test("clearing chat hides prior messages and preserves the durable audit rows", async () => {
  const t = convexTest(schema, modules);
  register(t);
  registerPresence(t);
  const [ownerId, outsiderId] = await t.run(async (ctx) => [
    await ctx.db.insert("users", {
      email: "owner@example.test",
      emailVerificationTime: 1,
    }),
    await ctx.db.insert("users", {
      email: "outsider@example.test",
      emailVerificationTime: 1,
    }),
  ]);
  const owner = t.withIdentity({ subject: ownerId });
  const outsider = t.withIdentity({ subject: outsiderId });
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    {
      slug: "chat-reset",
      name: "Chat reset",
      assignments: [{ email: "owner@example.test", admin: true }],
    },
  );
  await owner.mutation(api.Workspaces.claim);
  const messageId = await t.run(async (ctx) => {
    const authorId = await ctx.db.insert("documentAuthors", {
      kind: "agent",
      label: "Pluribus agent",
    });
    const threadId = await ctx.db.insert("assistantThreads", {
      workspaceId,
      authorId,
      updatedAt: Date.now(),
      generation: 1,
    });
    return ctx.db.insert("assistantMessages", {
      threadId,
      workspaceId,
      userId: ownerId,
      role: "user",
      text: "Arrange the board",
      status: "complete",
      tools: [],
    });
  });

  expect(await owner.query(api.Chat.messages, { workspaceId })).toHaveLength(1);
  await expect(
    outsider.mutation(api.Chat.clear, { workspaceId }),
  ).rejects.toThrow("access denied");
  await owner.mutation(api.Chat.clear, { workspaceId });
  expect(await owner.query(api.Chat.messages, { workspaceId })).toEqual([]);
  expect(await t.run((ctx) => ctx.db.get(messageId))).not.toBeNull();
});
