import { useEffect, useState, useMemo } from "react";
import {
  useConvex,
  useConvexAuth,
  useQueries,
  type ConvexReactClient,
} from "convex/react";
import {
  getFunctionName,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";
import { api } from "@pluribus/backend/api";
const guestKey = "pluribus-document-author-v1";
export type AuthorSession = FunctionReturnType<
  typeof api.Documents.openAuthorship
>;
const requests = new WeakMap<
  ConvexReactClient,
  Map<string, Promise<AuthorSession>>
>();
const guestBootstrap = new WeakMap<ConvexReactClient, Promise<AuthorSession>>();
/** Concurrent card mounts share guest identity, but request independent scoped sessions. */
export async function openAuthorSession(
  client: ConvexReactClient,
  id: string,
  authenticated: boolean,
) {
  if (authenticated)
    return client.mutation(api.Documents.openAuthorship, { id });
  const pending = guestBootstrap.get(client);
  if (pending) await pending;
  const stored = localStorage.getItem(guestKey);
  const guest = stored
    ? (JSON.parse(stored) as NonNullable<AuthorSession["guest"]>)
    : undefined;
  const request = client
    .mutation(api.Documents.openAuthorship, { id, ...(guest ? { guest } : {}) })
    .then((value) => {
      if (value.guest)
        localStorage.setItem(guestKey, JSON.stringify(value.guest));
      return value;
    });
  if (!guest) guestBootstrap.set(client, request);
  try {
    return await request;
  } finally {
    if (guestBootstrap.get(client) === request) guestBootstrap.delete(client);
  }
}

export function useAuthorship(id: string, enabled: boolean) {
  const client = useConvex(),
    auth = useConvexAuth();
  const identity = auth.isAuthenticated ? "user" : "guest";
  const [instance] = useState(() => crypto.randomUUID());
  const key = `${id}:${identity}:${instance}`;
  const [result, setResult] = useState<{
    key: string;
    session: AuthorSession;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || auth.isLoading) return;
    let active = true;
    setFailed(false);
    let map = requests.get(client);
    if (!map) requests.set(client, (map = new Map()));
    let request = map.get(key);
    if (!request) {
      request = openAuthorSession(client, id, auth.isAuthenticated);
      map.set(key, request);
      void request.then(
        () => map!.delete(key),
        () => map!.delete(key),
      );
    }
    void request.then(
      (session) => {
        if (active) setResult({ key, session });
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [client, key, id, enabled, auth.isLoading, auth.isAuthenticated]);
  return { session: result?.key === key ? result.session : null, failed };
}
/** Add author credentials only to this editor's submissions; the shared Convex client is untouched. */
export function authorshipTransport(
  client: ConvexReactClient,
  session: AuthorSession,
): ConvexReactClient {
  return new Proxy(client, {
    get(target, property) {
      if (property === "mutation")
        return (
          fn: FunctionReference<"mutation">,
          args: Record<string, unknown>,
        ) =>
          target.mutation(
            fn,
            getFunctionName(fn) === "Documents:submitSteps"
              ? { ...args, credential: session.credential, protocol: 1 }
              : args,
          );
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function useAuthorProfiles(
  id: string,
  authorIds: string,
  enabled: boolean,
) {
  const queries = useMemo(() => {
    const ids = JSON.parse(
      authorIds,
    ) as import("@pluribus/backend/dataModel").Id<"documentAuthors">[];
    const result: Parameters<typeof useQueries>[0] = {};
    if (enabled)
      for (let i = 0; i < ids.length; i += 256)
        result[String(i)] = {
          query: api.Documents.authors,
          args: { id, authors: ids.slice(i, i + 256) },
        };
    return result;
  }, [id, authorIds, enabled]);
  const results = useQueries(queries);
  return useMemo(
    () =>
      Object.values(results).flatMap((value) =>
        Array.isArray(value)
          ? (value as FunctionReturnType<typeof api.Documents.authors>)
          : [],
      ),
    [results],
  );
}
