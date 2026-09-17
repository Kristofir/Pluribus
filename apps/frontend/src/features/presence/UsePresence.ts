import { useCallback, useEffect, useState } from "react";
import { useConvex, type ConvexReactClient } from "convex/react";
import { api } from "@pluribus/backend/api";
import {
  contextKey,
  type InteractionEvent,
} from "@pluribus/core/presence/domain";
import { browserIdentity } from "./Identity";
import {
  createPresenceRegistry,
  emptySnapshot,
  type Context,
  type Identity,
  type Transport,
} from "./Registry";
const registries = new WeakMap<
  ConvexReactClient,
  ReturnType<typeof createPresenceRegistry>
>();
function registry(convex: ConvexReactClient) {
  let value = registries.get(convex);
  if (value) return value;
  const transport: Transport = {
    join: (context, identity) =>
      convex.mutation(api.Presence.join, {
        context,
        guestId: identity.guestId,
        tabId: identity.tabId,
      }),
    unload: (context, credentials) => {
      navigator.sendBeacon(
        `${convex.url}/api/mutation`,
        new Blob(
          [
            JSON.stringify({
              path: "Presence:leave",
              args: { context, ...credentials },
            }),
          ],
          { type: "application/json" },
        ),
      );
    },
    leave: (context, credentials) =>
      convex.mutation(api.Presence.leave, { context, ...credentials }),
    heartbeat: (context, credentials) =>
      convex.mutation(api.Presence.heartbeat, { context, ...credentials }),
    lifecycle: (context, credentials, sequence, hidden, focused) =>
      convex.mutation(api.Presence.lifecycle, {
        context,
        ...credentials,
        sequence,
        hidden,
        focused,
      }),
    publish: (context, credentials, activity, sequence) =>
      convex.mutation(api.Presence.publish, {
        context,
        ...credentials,
        activity,
        sequence,
      }),
    watch: (context, kind, changed) => {
      const watch =
        kind === "roster"
          ? convex.watchQuery(api.Presence.roster, { context })
          : convex.watchQuery(api.Presence.activities, { context });
      const dispose = watch.onUpdate(changed);
      return { read: () => watch.localQueryResult(), dispose };
    },
  };
  const created = createPresenceRegistry(transport, browserIdentity());
  registries.set(convex, created);
  const update = () =>
    created.emit({
      type: "environment-changed",
      environment: {
        online:
          navigator.onLine && convex.connectionState().isWebSocketConnected,
        visible: document.visibilityState !== "hidden",
        focused: document.hasFocus(),
      },
    });
  for (const event of ["online", "offline", "focus", "blur", "pageshow"])
    window.addEventListener(event, update);
  document.addEventListener("visibilitychange", update);
  window.addEventListener("pagehide", () => {
    created.emit({ type: "page-exited" });
  });
  convex.subscribeToConnectionState(update);
  update();
  return created;
}
export function usePresence(context: Context, active: boolean) {
  const convex = useConvex();
  const key = contextKey(context);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [lease, setLease] = useState<ReturnType<
    ReturnType<typeof createPresenceRegistry>["acquire"]
  > | null>(null);
  useEffect(() => {
    let active = true;
    void browserIdentity().then((value) => {
      if (active) setIdentity(value);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!active) {
      setLease(null);
      setSnapshot(emptySnapshot);
      return;
    }
    const acquired = registry(convex).acquire(context);
    setLease(acquired);
    const unsubscribe = acquired.subscribe(() =>
      setSnapshot(acquired.getSnapshot()),
    );
    setSnapshot(acquired.getSnapshot());
    return () => {
      unsubscribe();
      acquired.release();
    };
  }, [convex, key, active]);
  return {
    ...snapshot,
    identity,
    emit: useCallback((event: InteractionEvent) => lease?.emit(event), [lease]),
    toggle: useCallback(() => lease?.toggle(), [lease]),
  };
}
export type PresenceView = ReturnType<typeof usePresence>;
