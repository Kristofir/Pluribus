/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
const geometry = { x: 10, y: 20, width: 430, height: 500 };
const credential = () => ({
  operation: crypto.randomUUID(),
  secret: crypto.randomUUID(),
});
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

for (const element of [
  { kind: "rectangle" as const, geometry, color: "blue" as const },
  { kind: "document" as const, geometry },
]) {
  test(`${element.kind} creation retries once; Undo/Redo retains identity and rejects old generations`, async () => {
    const t = setup();
    const command = { ...credential(), element };
    const result = await t.mutation(api.Canvas.createElement, command);
    expect(result.status).toBe("created");
    expect(await t.mutation(api.Canvas.createElement, command)).toEqual(result);
    const id = result.id!;
    const before = await t.run((ctx) => ctx.db.get(id));
    const deletion = credential();
    await t.mutation(api.Canvas.deleteElement, {
      id,
      generation: 1,
      ...deletion,
    });
    expect((await t.mutation(api.Canvas.createElement, command)).status).toBe(
      "conflict",
    );
    await t.mutation(api.Canvas.undoDeletion, deletion);
    const after = await t.run((ctx) => ctx.db.get(id));
    expect(after).toMatchObject({
      ...before,
      generation: 3,
      ...(element.kind === "document" ? { removed: false } : {}),
    });
    expect(
      (
        await t.mutation(api.Canvas.deleteElement, {
          id,
          generation: 1,
          ...credential(),
        })
      ).status,
    ).toBe("conflict");
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("canvasCreations")
          .withIndex("by_operation", (q) =>
            q.eq("operation", command.operation),
          )
          .take(2),
      ),
    ).toHaveLength(1);
  });
}
test("creation binds owner, capability and payload; capacity rejection leaves no receipt", async () => {
  const t = setup();
  const user = await t.run((ctx) => ctx.db.insert("users", {}));
  const owner = t.withIdentity({ subject: user });
  const command = {
    ...credential(),
    element: { kind: "document" as const, geometry },
  };
  await owner.mutation(api.Canvas.createElement, command);
  await expect(t.mutation(api.Canvas.createElement, command)).rejects.toThrow(
    "another editing session",
  );
  await expect(
    owner.mutation(api.Canvas.createElement, {
      ...command,
      secret: crypto.randomUUID(),
    }),
  ).rejects.toThrow("another editing session");
  await expect(
    owner.mutation(api.Canvas.createElement, {
      ...command,
      element: { ...command.element, geometry: { ...geometry, x: 99 } },
    }),
  ).rejects.toThrow("reused");
  await owner.mutation(api.Canvas.createElement, {
    ...command,
    ...credential(),
  });
  const rejected = { ...command, ...credential() };
  expect(
    (await owner.mutation(api.Canvas.createElement, rejected)).status,
  ).toBe("full");
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("canvasCreations")
        .withIndex("by_operation", (q) => q.eq("operation", rejected.operation))
        .unique(),
    ),
  ).toBeNull();
});
