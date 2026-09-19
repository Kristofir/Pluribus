/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("signed-out callers cannot read a profile", async () => {
  const backend = convexTest(schema, modules);
  await expect(backend.query(api.Users.current, {})).resolves.toBeNull();
});

test("each caller receives only their own stable ID and display fields", async () => {
  const backend = convexTest(schema, modules);
  const [first, second] = await backend.run(async (ctx) => {
    return Promise.all([
      ctx.db.insert("users", {
        name: "First user",
        email: "first@example.test",
        phone: "private profile field",
      }),
      ctx.db.insert("users", { name: "Second user" }),
    ]);
  });

  const firstCaller = backend.withIdentity({ subject: `${first}|session-one` });
  const secondCaller = backend.withIdentity({
    subject: `${second}|session-two`,
  });
  await expect(firstCaller.query(api.Users.current, {})).resolves.toEqual({
    id: first,
    name: "First user",
    email: "first@example.test",
  });
  await expect(secondCaller.query(api.Users.current, {})).resolves.toEqual({
    id: second,
    name: "Second user",
  });
});

test("a deleted user cannot read a profile with a remaining identity", async () => {
  const backend = convexTest(schema, modules);
  const userId = await backend.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Deleted user" });
    await ctx.db.delete("users", id);
    return id;
  });
  const caller = backend.withIdentity({ subject: `${userId}|old-session` });
  await expect(caller.query(api.Users.current, {})).resolves.toBeNull();
});
