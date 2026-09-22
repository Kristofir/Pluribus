/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register as registerPresence } from "@convex-dev/presence/test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

test("a share link admits anonymous collaborators to the normal workspace and revocation removes access", async () => {
  const t = convexTest(schema, modules);
  register(t);
  registerPresence(t);
  const [ownerId, guestId, secondGuestId, upgradedId] = await t.run(
    async (ctx) => [
      await ctx.db.insert("users", {
        email: "owner@example.test",
        emailVerificationTime: 1,
      }),
      await ctx.db.insert("users", { isAnonymous: true, name: "Guest A" }),
      await ctx.db.insert("users", { isAnonymous: true, name: "Guest B" }),
      await ctx.db.insert("users", {
        email: "member@example.test",
        emailVerificationTime: 1,
      }),
    ],
  );
  const owner = t.withIdentity({ subject: ownerId });
  const guest = t.withIdentity({ subject: guestId });
  const secondGuest = t.withIdentity({ subject: secondGuestId });
  const upgraded = t.withIdentity({ subject: upgradedId });
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    {
      slug: "guest-collaboration",
      name: "Guest collaboration",
      assignments: [
        { email: "owner@example.test", admin: true },
        { email: "member@example.test", admin: false },
      ],
    },
  );
  await owner.mutation(api.Workspaces.claim);
  await expect(
    guest.query(api.Workspaces.open, { workspaceId }),
  ).rejects.toThrow("access denied");
  expect(await guest.query(api.Workspaces.access, { workspaceId })).toBe(false);
  const token = await owner.mutation(api.ShareLinks.create, { workspaceId });
  expect(token).toHaveLength(72);
  expect(await owner.mutation(api.ShareLinks.ensure, { workspaceId })).toBe(
    token,
  );
  await expect(t.mutation(api.ShareLinks.redeem, { token })).rejects.toThrow(
    "Guest session required",
  );
  expect(await guest.mutation(api.ShareLinks.redeem, { token })).toBe(
    workspaceId,
  );
  await upgraded.mutation(api.ShareLinks.redeem, { token });
  await upgraded.mutation(api.Workspaces.claim);
  const opened = await guest.query(api.Workspaces.open, { workspaceId });
  expect(opened.name).toBe("Guest collaboration");
  expect(await guest.query(api.Workspaces.access, { workspaceId })).toBe(true);
  expect((await guest.query(api.Inbox.list, { workspaceId })).threads).toEqual(
    [],
  );
  const grant = await guest.mutation(api.AgentAccess.grant, {
    workspaceId,
    label: "Guest agent",
  });
  expect(grant.token).toHaveLength(72);
  expect((await guest.query(api.Workspaces.list)).map((w) => w.id)).toContain(
    workspaceId,
  );
  const cardId = await guest.mutation(api.Canvas.createDocument, {
    workspaceId,
    geometry: { x: 100, y: 100, width: 430, height: 500 },
  });
  expect(
    (await owner.query(api.Canvas.documentCards, { workspaceId })).map(
      (card) => card.id,
    ),
  ).toContain(cardId);
  const documentCard = (
    await guest.query(api.Canvas.documentCards, { workspaceId })
  ).find((card) => card.id === cardId)!;
  const card = await guest.query(api.Documents.describe, {
    documentId: documentCard.documentId,
  });
  expect(card.role).toBe("card");
  expect(
    await guest.query(api.Documents.latestVersion, {
      id: `${documentCard.documentId}:${card.generation}`,
    }),
  ).toBe(1);
  await expect(
    guest.query(api.Workspaces.admin, {
      table: "workspaces",
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("Administrator");

  await secondGuest.mutation(api.ShareLinks.redeem, { token });
  const rotated = await guest.mutation(api.ShareLinks.create, { workspaceId });
  expect(rotated).not.toBe(token);
  expect(await owner.mutation(api.ShareLinks.ensure, { workspaceId })).toBe(
    rotated,
  );
  expect((await guest.query(api.Workspaces.open, { workspaceId })).name).toBe(
    "Guest collaboration",
  );
  await expect(
    secondGuest.query(api.Workspaces.open, { workspaceId }),
  ).rejects.toThrow("access denied");
  expect(await secondGuest.query(api.Workspaces.access, { workspaceId })).toBe(
    false,
  );
  await expect(
    secondGuest.mutation(api.ShareLinks.redeem, { token }),
  ).rejects.toThrow("Share link unavailable");
  await owner.mutation(api.ShareLinks.revoke, { workspaceId });
  await expect(
    guest.query(api.Workspaces.open, { workspaceId }),
  ).rejects.toThrow("access denied");
  expect(await guest.query(api.Workspaces.access, { workspaceId })).toBe(false);
  await expect(
    guest.query(api.AgentAccess.connectionInfo, { workspaceId }),
  ).rejects.toThrow("access denied");
  expect(await guest.query(api.Workspaces.list)).toEqual([]);
  expect(await upgraded.query(api.Workspaces.access, { workspaceId })).toBe(
    true,
  );
  expect((await owner.query(api.Workspaces.open, { workspaceId })).name).toBe(
    "Guest collaboration",
  );
});
