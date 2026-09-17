import { afterEach, expect, test, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { openAuthorSession } from "./UseAuthorship";

afterEach(() => vi.unstubAllGlobals());
test("concurrent cards share a durable guest but get separate sessions", async () => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  let count = 0;
  const mutation = vi.fn(async (_fn, args) => {
    await Promise.resolve();
    const session = String(++count);
    const guest = args.guest ?? { author: "guest-" + session, secret: "test" };
    return {
      author: guest.author,
      credential: { session, secret: "test" },
      guest,
    };
  });
  const client = { mutation } as unknown as ConvexReactClient;
  const [a, b] = await Promise.all([
    openAuthorSession(client, "document-a:1", false),
    openAuthorSession(client, "document-b:1", false),
  ]);
  expect(a.author).toBe(b.author);
  expect(a.credential.session).not.toBe(b.credential.session);
  expect(mutation.mock.calls.map(([, args]) => args.id)).toEqual([
    "document-a:1",
    "document-b:1",
  ]);
  const restored = await openAuthorSession(client, "document-a:3", false);
  expect(restored.author).toBe(a.author);
  expect(restored.credential.session).not.toBe(a.credential.session);
});
