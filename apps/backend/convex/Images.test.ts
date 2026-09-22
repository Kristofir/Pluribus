/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const token = () => crypto.randomUUID();
const geometry = { x: 90, y: 120, width: 360, height: 276 };

async function setup() {
  const t = convexTest(schema, modules);
  const { userId, workspaceId, foreignId } = await t.run(async (ctx) => ({
    userId: await ctx.db.insert("users", {}),
    workspaceId: await ctx.db.insert("workspaces", {
      name: "Images",
      slug: "images",
    }),
    foreignId: await ctx.db.insert("workspaces", {
      name: "Other",
      slug: "other-images",
    }),
  }));
  await t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId, userId }),
  );
  const user = t.withIdentity({ subject: userId });
  const secret = token();
  const session = await user.mutation(api.Canvas.openHistorySession, {
    workspaceId,
    nonce: token(),
    secret,
  });
  return { t, user, workspaceId, foreignId, auth: { session, secret } };
}

test("server-imported image can enter the same History path only for a workspace member", async () => {
  const { t, user, workspaceId, auth } = await setup();
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["GIF89a"], { type: "image/gif" })),
  );
  await expect(
    t.mutation(internal.canvas.UrlImportAccess.register, {
      workspaceId,
      storageId,
      name: "photo",
      contentType: "image/gif",
    }),
  ).rejects.toThrow("access denied");
  const uploadId = await user.mutation(
    internal.canvas.UrlImportAccess.register,
    {
      workspaceId,
      storageId,
      name: "photo",
      contentType: "image/gif",
    },
  );
  const created = await user.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "create", element: { kind: "image", uploadId, geometry } },
  });
  expect(created.status).toBe("applied");
  expect(
    await user.query(api.Canvas.imageCards, { workspaceId }),
  ).toMatchObject([{ uploadId, name: "photo" }]);
});

test("image upload is authorized, validated, and survives geometry and lifecycle History", async () => {
  const { t, user, workspaceId, foreignId, auth } = await setup();
  await expect(
    t.mutation(api.Canvas.prepareImageUpload, { workspaceId }),
  ).rejects.toThrow("access denied");
  await expect(
    user.mutation(api.Canvas.prepareImageUpload, { workspaceId: foreignId }),
  ).rejects.toThrow("access denied");
  const { uploadId, url } = await user.mutation(api.Canvas.prepareImageUpload, {
    workspaceId,
  });
  expect(url).toBeTruthy();
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["pixel"], { type: "image/png" })),
  );
  // convex-test storage.store omits contentType from its _storage fixture.
  await t.run((ctx) =>
    (
      ctx.db as unknown as {
        patch: (table: string, id: string, fields: object) => Promise<void>;
      }
    ).patch("_storage", storageId, { contentType: "image/png" }),
  );
  const create = {
    ...auth,
    action: token(),
    attempt: token(),
    input: {
      kind: "create" as const,
      element: { kind: "image" as const, uploadId, geometry },
    },
  };
  await expect(
    user.mutation(api.Canvas.applyHistoryAction, create),
  ).rejects.toThrow("not ready");
  expect(
    await user.mutation(api.Canvas.registerImageUpload, {
      uploadId,
      storageId,
      name: "sample.png",
    }),
  ).toBe(true);
  const created = await user.mutation(api.Canvas.applyHistoryAction, create);
  expect(created.status).toBe("applied");
  expect(await user.mutation(api.Canvas.applyHistoryAction, create)).toEqual(
    created,
  );
  const cards = await user.query(api.Canvas.imageCards, { workspaceId });
  expect(cards).toMatchObject([
    { id: created.id, uploadId, name: "sample.png", geometry, generation: 1 },
  ]);
  expect(cards[0].url).toBeTruthy();
  await expect(t.query(api.Canvas.imageCards, { workspaceId })).rejects.toThrow(
    "access denied",
  );
  expect(await user.mutation(api.Canvas.discardImageUpload, { uploadId })).toBe(
    false,
  );
  await t.mutation(internal.Canvas.cleanupImageUpload, { uploadId });
  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
  const id = await t.run(async (ctx) =>
    ctx.db.normalizeId("canvasImages", created.id!)!,
  );
  expect(
    await user.mutation(api.Canvas.changeImage, {
      workspaceId,
      id,
      generation: 1,
      geometry: { ...geometry, x: 210 },
    }),
  ).toBe(true);
  const moveAction = token();
  expect(
    await user.mutation(api.Canvas.updateHistoryGesture, {
      ...auth,
      action: moveAction,
      sequence: 1,
      updates: [{ id, generation: 1, geometry: { ...geometry, x: 350 } }],
    }),
  ).toMatchObject({ status: "accepted" });
  const moved = await user.mutation(api.Canvas.closeHistoryGesture, {
    ...auth,
    action: moveAction,
    attempt: token(),
    sequence: 1,
  });
  expect(moved.status).toBe("applied");
  expect(
    (await user.query(api.Canvas.imageCards, { workspaceId }))[0].geometry.x,
  ).toBe(350);
  expect(
    (
      await user.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: moveAction,
        attempt: token(),
        revision: moved.revision,
        undo: true,
      })
    ).status,
  ).toBe("applied");
  expect(
    (await user.query(api.Canvas.imageCards, { workspaceId }))[0].geometry.x,
  ).toBe(210);
  const deletion = await user.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: token(),
    attempt: token(),
    input: { kind: "delete", id, generation: 1 },
  });
  expect(deletion.status).toBe("applied");
  expect(await user.query(api.Canvas.imageCards, { workspaceId })).toEqual([]);
  expect(
    await user.mutation(api.Canvas.changeImage, {
      workspaceId,
      id,
      generation: 1,
      geometry,
    }),
  ).toBe(false);
  const restored = await user.mutation(api.Canvas.reverseHistoryAction, {
    ...auth,
    action: deletion.action,
    attempt: token(),
    revision: deletion.revision,
    undo: true,
  });
  expect(restored.status).toBe("applied");
  expect(
    (await user.query(api.Canvas.imageCards, { workspaceId }))[0],
  ).toMatchObject({ id, generation: 3 });
});

test("bad image types cannot become cards, and unclaimed uploads can be discarded", async () => {
  const { t, user, workspaceId, auth } = await setup();
  const { uploadId } = await user.mutation(api.Canvas.prepareImageUpload, {
    workspaceId,
  });
  const outsiderId = await t.run((ctx) => ctx.db.insert("users", {}));
  const outsider = t.withIdentity({ subject: outsiderId });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["<svg/>"], { type: "image/svg+xml" })),
  );
  await expect(
    outsider.mutation(api.Canvas.registerImageUpload, {
      uploadId,
      storageId,
      name: "bad.svg",
    }),
  ).rejects.toThrow("access denied");
  expect(
    await user.mutation(api.Canvas.registerImageUpload, {
      uploadId,
      storageId,
      name: "bad.svg",
    }),
  ).toBe(false);
  await expect(
    user.mutation(api.Canvas.applyHistoryAction, {
      ...auth,
      action: token(),
      attempt: token(),
      input: { kind: "create", element: { kind: "image", uploadId, geometry } },
    }),
  ).rejects.toThrow("Invalid image upload");
  expect(await user.mutation(api.Canvas.discardImageUpload, { uploadId })).toBe(
    true,
  );
  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  expect(await user.query(api.Canvas.imageCards, { workspaceId })).toEqual([]);
});

test("an expired unclaimed upload is cleaned up without deleting claimed cards", async () => {
  const { t, user, workspaceId } = await setup();
  const { uploadId } = await user.mutation(api.Canvas.prepareImageUpload, {
    workspaceId,
  });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["pixel"], { type: "image/png" })),
  );
  await t.run((ctx) =>
    (
      ctx.db as unknown as {
        patch: (table: string, id: string, fields: object) => Promise<void>;
      }
    ).patch("_storage", storageId, { contentType: "image/png" }),
  );
  expect(
    await user.mutation(api.Canvas.registerImageUpload, {
      uploadId,
      storageId,
      name: "unused.png",
    }),
  ).toBe(true);
  await t.mutation(internal.Canvas.cleanupImageUpload, { uploadId });
  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
});
