/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { FunctionArgs } from "convex/server";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 10, y: 20, width: 430, height: 500 };
const uuid = () => crypto.randomUUID();
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}
async function session(t: Pick<ReturnType<typeof setup>, "mutation">) {
  const registration = { nonce: uuid(), secret: uuid() };
  const id = await t.mutation(api.Canvas.openHistorySession, registration);
  expect(await t.mutation(api.Canvas.openHistorySession, registration)).toBe(
    id,
  );
  return { session: id, secret: registration.secret };
}
afterEach(() => vi.useRealTimers());
for (const element of [
  { kind: "rectangle" as const, color: "blue" as const, geometry },
  { kind: "document" as const, geometry },
]) {
  test(`${element.kind}: full create/move/delete Undo all and Redo all preserves identity`, async () => {
    const t = setup(),
      auth = await session(t);
    const create = {
      ...auth,
      action: uuid(),
      attempt: uuid(),
      input: { kind: "create" as const, element },
    };
    const created = await t.mutation(api.Canvas.applyHistoryAction, create),
      id = created.id!;
    const original = await t.run((ctx) => ctx.db.get(id));
    const action = uuid(),
      moved = { ...geometry, x: 70 };
    await t.mutation(api.Canvas.updateHistoryGesture, {
      ...auth,
      action,
      sequence: 1,
      updates: [{ id, generation: 1, geometry: moved }],
    });
    await t.mutation(api.Canvas.closeHistoryGesture, {
      ...auth,
      action,
      attempt: uuid(),
      sequence: 1,
    });
    const deleted = await t.mutation(api.Canvas.applyHistoryAction, {
      ...auth,
      action: uuid(),
      attempt: uuid(),
      input: { kind: "delete", id, generation: 1 },
    });
    const reverse = (a: string, revision: number, undo: boolean) =>
      t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: a,
        attempt: uuid(),
        revision,
        undo,
      });
    expect((await reverse(deleted.action, 1, true)).status).toBe("applied");
    expect((await reverse(action, 1, true)).status).toBe("applied");
    expect((await reverse(create.action, 1, true)).status).toBe("applied");
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      generation: 4,
      removed: true,
    });
    expect((await reverse(create.action, 2, false)).status).toBe("applied");
    expect((await reverse(action, 2, false)).status).toBe("applied");
    expect((await reverse(deleted.action, 2, false)).status).toBe("applied");
    expect((await reverse(deleted.action, 3, true)).status).toBe("applied");
    const restored = await t.run((ctx) => ctx.db.get(id));
    expect(restored).toMatchObject({
      _id: original!._id,
      x: 70,
      generation: 7,
    });
    if (element.kind === "document")
      expect(restored).toHaveProperty(
        "documentId",
        (original as { documentId: string }).documentId,
      );
    expect(await t.mutation(api.Canvas.applyHistoryAction, create)).toEqual(
      created,
    );
  });
}
test("accepted attempts and latest stream ACK survive peer edits and lifecycle changes", async () => {
  const t = setup(),
    auth = await session(t),
    peer = await session(t);
  const create = {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input: {
      kind: "create" as const,
      element: { kind: "rectangle" as const, color: "blue" as const, geometry },
    },
  };
  const created = await t.mutation(api.Canvas.applyHistoryAction, create),
    id = created.id!;
  const update = {
    ...auth,
    action: uuid(),
    sequence: 1,
    updates: [{ id, generation: 1, geometry: { ...geometry, x: 42 } }],
  };
  const ack = await t.mutation(api.Canvas.updateHistoryGesture, update);
  const deletion = await t.mutation(api.Canvas.applyHistoryAction, {
    ...peer,
    action: uuid(),
    attempt: uuid(),
    input: { kind: "delete", id, generation: 1 },
  });
  await t.mutation(api.Canvas.reverseHistoryAction, {
    ...peer,
    action: deletion.action,
    attempt: uuid(),
    revision: 1,
    undo: true,
  });
  expect(await t.mutation(api.Canvas.applyHistoryAction, create)).toEqual(
    created,
  );
  expect(await t.mutation(api.Canvas.updateHistoryGesture, update)).toEqual(
    ack,
  );
  await t.mutation(api.Canvas.closeHistoryGesture, {
    ...auth,
    action: update.action,
    attempt: uuid(),
    sequence: 1,
  });
  expect(
    (
      await t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: update.action,
        attempt: uuid(),
        revision: 1,
        undo: true,
      })
    ).status,
  ).toBe("obsolete");
  const newer = {
    ...auth,
    action: uuid(),
    sequence: 1,
    updates: [{ id, generation: 3, geometry: { ...geometry, x: 60 } }],
  };
  await t.mutation(api.Canvas.updateHistoryGesture, newer);
  expect(
    (
      await t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: create.action,
        attempt: uuid(),
        revision: 1,
        undo: true,
      })
    ).status,
  ).toBe("obsolete");
});
test("session capabilities, attempt payloads, deterministic errors and capacity are isolated", async () => {
  const t = setup(),
    auth = await session(t);
  const input = {
    kind: "create" as const,
    element: { kind: "document" as const, geometry },
  };
  const first = { ...auth, action: uuid(), attempt: uuid(), input };
  await expect(
    t.mutation(api.Canvas.applyHistoryAction, { ...first, secret: uuid() }),
  ).rejects.toThrow("another editing session");
  await t.mutation(api.Canvas.applyHistoryAction, first);
  expect(
    (
      await t.mutation(api.Canvas.applyHistoryAction, {
        ...first,
        input: {
          ...input,
          element: { ...input.element, geometry: { ...geometry, x: 5 } },
        },
      })
    ).status,
  ).toBe("rejected");
  const second = await t.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input,
  });
  const blocked = { ...auth, action: uuid(), attempt: uuid(), input };
  expect(
    (await t.mutation(api.Canvas.applyHistoryAction, blocked)).status,
  ).toBe("blocked");
  await t.mutation(api.Canvas.reverseHistoryAction, {
    ...auth,
    action: second.action,
    attempt: uuid(),
    revision: 1,
    undo: true,
  });
  expect(
    (await t.mutation(api.Canvas.applyHistoryAction, blocked)).status,
  ).toBe("blocked");
  expect(
    (
      await t.mutation(api.Canvas.applyHistoryAction, {
        ...blocked,
        attempt: uuid(),
      })
    ).status,
  ).toBe("applied");
});
test("idle closure retains accepted cursor; retries never renew or reopen it", async () => {
  vi.useFakeTimers();
  const t = setup(),
    auth = await session(t);
  const id = await t.mutation(api.Canvas.create, { geometry, color: "blue" });
  const update = {
    ...auth,
    action: uuid(),
    sequence: 1,
    updates: [{ id, generation: 1, geometry: { ...geometry, x: 40 } }],
  };
  await t.mutation(api.Canvas.updateHistoryGesture, update);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(
    await t.mutation(api.Canvas.heartbeatHistoryGesture, {
      ...auth,
      action: update.action,
    }),
  ).toBe(true);
  await t.mutation(internal.canvas.History.expireGesture, {
    session: auth.session,
    action: update.action,
  });
  expect(
    (
      await t.query(api.Canvas.readHistoryAction, {
        ...auth,
        action: update.action,
      })
    )?.state,
  ).toBe("open");
  await vi.advanceTimersByTimeAsync(31_000);
  await t.mutation(internal.canvas.History.expireGesture, {
    session: auth.session,
    action: update.action,
  });
  expect(await t.mutation(api.Canvas.updateHistoryGesture, update)).toEqual({
    status: "accepted",
    sequence: 1,
  });
  expect(
    (
      await t.mutation(api.Canvas.updateHistoryGesture, {
        ...update,
        sequence: 2,
      })
    ).status,
  ).toBe("closed");
  expect(
    await t.mutation(api.Canvas.heartbeatHistoryGesture, {
      ...auth,
      action: update.action,
    }),
  ).toBe(false);
  expect(
    (
      await t.mutation(api.Canvas.closeHistoryGesture, {
        ...auth,
        action: update.action,
        attempt: uuid(),
        sequence: 1,
      })
    ).status,
  ).toBe("applied");
});
test("geometry groups are atomic; old sequences and exact deletion identities cannot overwrite newer work", async () => {
  const t = setup(),
    auth = await session(t);
  const ids = await Promise.all(
    ["blue", "coral"].map((color) =>
      t.mutation(api.Canvas.create, {
        geometry,
        color: color as "blue" | "coral",
      }),
    ),
  );
  const command: FunctionArgs<typeof api.Canvas.updateHistoryGesture> = {
    ...auth,
    action: uuid(),
    sequence: 1,
    updates: ids.map((id) => ({
      id,
      generation: 1,
      geometry: { ...geometry, x: 40 },
    })),
  };
  await t.mutation(api.Canvas.updateHistoryGesture, command);
  await t.mutation(api.Canvas.updateHistoryGesture, {
    ...command,
    sequence: 2,
    updates: command.updates.map((u) => ({
      ...u,
      geometry: { ...geometry, x: 50 },
    })),
  });
  expect(
    (
      await t.mutation(api.Canvas.updateHistoryGesture, {
        ...command,
        updates: command.updates.map((u) => ({
          ...u,
          geometry: { ...geometry, x: 99 },
        })),
      })
    ).status,
  ).toBe("superseded");
  await t.mutation(api.Canvas.closeHistoryGesture, {
    ...auth,
    action: command.action,
    attempt: uuid(),
    sequence: 2,
  });
  await t.mutation(api.Canvas.updateGeometry, {
    id: ids[1],
    generation: 1,
    geometry: { ...geometry, x: 80 },
  });
  expect(
    (
      await t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: command.action,
        attempt: uuid(),
        revision: 1,
        undo: true,
      })
    ).status,
  ).toBe("obsolete");
  expect(await t.run((ctx) => ctx.db.get(ids[0]))).toMatchObject({ x: 50 });
  const d1 = await t.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input: { kind: "delete", id: ids[0], generation: 1 },
  });
  await t.mutation(api.Canvas.reverseHistoryAction, {
    ...auth,
    action: d1.action,
    attempt: uuid(),
    revision: 1,
    undo: true,
  });
  await t.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input: { kind: "delete", id: ids[0], generation: 3 },
  });
  expect(
    (
      await t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: d1.action,
        attempt: uuid(),
        revision: 2,
        undo: false,
      })
    ).status,
  ).toBe("obsolete");
});

test("unknown close is rejected; a live gesture cannot adopt a restored write generation", async () => {
  const t = setup(),
    auth = await session(t),
    action = uuid();
  expect(
    (
      await t.mutation(api.Canvas.closeHistoryGesture, {
        ...auth,
        action,
        attempt: uuid(),
        sequence: 0,
      })
    ).status,
  ).toBe("rejected");
  const id = await t.mutation(api.Canvas.create, { geometry, color: "blue" });
  const update = {
    ...auth,
    action,
    sequence: 1,
    updates: [{ id, generation: 1, geometry: { ...geometry, x: 50 } }],
  };
  await t.mutation(api.Canvas.updateHistoryGesture, update);
  const deleted = await t.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input: { kind: "delete", id, generation: 1 },
  });
  await t.mutation(api.Canvas.reverseHistoryAction, {
    ...auth,
    action: deleted.action,
    attempt: uuid(),
    revision: 1,
    undo: true,
  });
  expect(
    (
      await t.mutation(api.Canvas.updateHistoryGesture, {
        ...update,
        sequence: 2,
        updates: [{ id, generation: 3, geometry: { ...geometry, x: 70 } }],
      })
    ).status,
  ).toBe("conflict");
  expect(await t.mutation(api.Canvas.updateHistoryGesture, update)).toEqual({
    status: "accepted",
    sequence: 1,
  });
  await t.mutation(api.Canvas.closeHistoryGesture, {
    ...auth,
    action,
    attempt: uuid(),
    sequence: 1,
  });
  expect(
    (
      await t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action,
        attempt: uuid(),
        revision: 1,
        undo: true,
      })
    ).status,
  ).toBe("applied");
});

test("legacy lifecycle endpoints cannot restore V2 removals or preserve V2 continuity", async () => {
  const t = setup(),
    auth = await session(t);
  const created = await t.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input: { kind: "create", element: { kind: "document", geometry } },
  });
  const id = created.id!;
  const removed = await t.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input: { kind: "delete", id, generation: 1 },
  });
  expect(
    await t.mutation(internal.canvas.LegacyDocuments.restoreLegacy, {}),
  ).toBe(0);
  const legacy = { operation: uuid(), secret: uuid() };
  expect(
    (
      await t.mutation(api.Canvas.deleteElement, {
        id,
        generation: 2,
        ...legacy,
      })
    ).status,
  ).toBe("conflict");
  await t.mutation(api.Canvas.reverseHistoryAction, {
    ...auth,
    action: removed.action,
    attempt: uuid(),
    revision: 1,
    undo: true,
  });
  await t.mutation(api.Canvas.deleteElement, { id, generation: 3, ...legacy });
  await t.mutation(api.Canvas.undoDeletion, legacy);
  expect(
    (
      await t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action: created.action,
        attempt: uuid(),
        revision: 1,
        undo: true,
      })
    ).status,
  ).toBe("obsolete");
  expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ generation: 5 });
});

test("authenticated owners and separate same-owner tabs cannot reverse another session's action", async () => {
  const t = setup();
  const user = await t.run((ctx) => ctx.db.insert("users", {}));
  const owner = t.withIdentity({ subject: user }),
    auth = await session(owner),
    otherTab = await session(owner);
  const created = await owner.mutation(api.Canvas.applyHistoryAction, {
    ...auth,
    action: uuid(),
    attempt: uuid(),
    input: {
      kind: "create",
      element: { kind: "rectangle", color: "blue", geometry },
    },
  });
  const request = {
    ...auth,
    action: created.action,
    revision: 1,
    undo: true,
    attempt: uuid(),
  };
  await expect(
    t.mutation(api.Canvas.reverseHistoryAction, request),
  ).rejects.toThrow("another editing session");
  expect(
    (
      await owner.mutation(api.Canvas.reverseHistoryAction, {
        ...request,
        ...otherTab,
      })
    ).status,
  ).toBe("obsolete");
});

test("maximal 202-target group has bounded payload and no per-update attempt rows", async () => {
  const t = setup(),
    auth = await session(t);
  const ids = await t.run(async (ctx) => {
    const values = [];
    for (let i = 0; i < 200; i++)
      values.push(
        await ctx.db.insert("rectangles", {
          ...geometry,
          color: "blue",
          generation: 1,
        }),
      );
    return values;
  });
  const docs = await Promise.all(
    [0, 1].map(() => t.mutation(api.Canvas.createDocument, { geometry })),
  );
  const action = uuid(),
    updates = [...ids, ...docs].map((id) => ({
      id,
      generation: 1,
      geometry: { ...geometry, x: 30 },
    }));
  await t.mutation(api.Canvas.updateHistoryGesture, {
    ...auth,
    action,
    sequence: 1,
    updates,
  });
  await t.mutation(api.Canvas.updateHistoryGesture, {
    ...auth,
    action,
    sequence: 2,
    updates: updates.map((u) => ({ ...u, geometry: { ...geometry, x: 50 } })),
  });
  const receipt = await t.run((ctx) =>
    ctx.db
      .query("canvasHistoryActions")
      .withIndex("by_session_action", (q) =>
        q.eq("session", auth.session).eq("action", action),
      )
      .unique(),
  );
  const bytes = new TextEncoder().encode(JSON.stringify(receipt)).length;
  expect(bytes).toBeLessThan(128 * 1024);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("canvasHistoryAttempts")
        .withIndex("by_session_attempt", (q) => q.eq("session", auth.session))
        .take(2),
    ),
  ).toEqual([]);
  const targets = await t.run((ctx) =>
    ctx.db
      .query("canvasHistoryTargets")
      .withIndex("by_session_element", (q) => q.eq("session", auth.session))
      .take(203),
  );
  expect(targets).toHaveLength(202);
  console.info(
    `History maximum fixture: 202 targets, ${bytes} action bytes, 202 continuity rows; 0 durable attempts for two stream updates.`,
  );
  await t.mutation(api.Canvas.closeHistoryGesture, {
    ...auth,
    action,
    attempt: uuid(),
    sequence: 2,
  });
  expect(
    (
      await t.mutation(api.Canvas.reverseHistoryAction, {
        ...auth,
        action,
        revision: 1,
        undo: true,
        attempt: uuid(),
      })
    ).status,
  ).toBe("applied");
  expect(await t.run((ctx) => ctx.db.get(ids[199]))).toMatchObject({
    x: geometry.x,
  });
  await expect(
    t.mutation(api.Canvas.updateHistoryGesture, {
      ...auth,
      action: uuid(),
      sequence: 1,
      updates: [...updates, updates[0]],
    }),
  ).rejects.toThrow("Invalid geometry sequence or targets");
});
