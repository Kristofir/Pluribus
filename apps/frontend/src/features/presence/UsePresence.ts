import { useCallback, useEffect, useMemo, useState } from "react";
import { useConvex, type ConvexReactClient } from "convex/react";
import { api } from "@pluribus/backend/api";
import {
  contextKey,
  type InteractionEvent,
} from "@pluribus/core/presence/domain";
import { browserIdentity } from "./Identity";
import {
  createBrowserOwnership,
  type BrowserCredential,
  type BrowserEnvironment,
} from "./BrowserOwnership";
import { createBrowserCoordination } from "./BrowserCoordination";
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
  let owner: BrowserCredential | null = null;
  let participating = false;
  let account: BrowserEnvironment["account"];
  let ownership: ReturnType<typeof createBrowserOwnership>;
  const transport: Transport = {
    join: (context, identity) => {
      if (!owner)
        return Promise.reject(
          new Error("Browser presence is following another tab"),
        );
      return convex.mutation(api.Presence.join, {
        context,
        guestId: identity.guestId,
        tabId: identity.tabId,
        browser: owner,
      });
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
          : kind === "agents"
            ? convex.watchQuery(api.Presence.agents, { context })
            : convex.watchQuery(api.Presence.activities, { context });
      const dispose = watch.onUpdate(changed);
      return { read: () => watch.localQueryResult(), dispose };
    },
  };
  const created = createPresenceRegistry(
    transport,
    browserIdentity(),
    (active) => {
      participating = active;
      update();
    },
  );
  registries.set(convex, created);
  const environment = () => ({
    online: navigator.onLine && convex.connectionState().isWebSocketConnected,
    visible: document.visibilityState !== "hidden",
    focused: document.hasFocus(),
    ownsBrowser: owner !== null,
  });
  const applyEnvironment = () =>
    created.emit({ type: "environment-changed", environment: environment() });
  const coordination = createBrowserCoordination(convex.url, () =>
    ownership.observe(),
  );
  ownership = createBrowserOwnership(
    {
      ...coordination,
      claim: (claim) => convex.mutation(api.Presence.claimBrowser, claim),
      release: (browser) =>
        convex.mutation(api.Presence.releaseBrowser, { browser }),
    },
    (next) => {
      // Drop old queues before a successor's credential can be used by a join.
      if (owner !== next) {
        owner = null;
        applyEnvironment();
        owner = next;
        applyEnvironment();
      }
    },
    (error) => created.reportError(error),
  );
  function update() {
    ownership.update({ ...environment(), participating, account });
    applyEnvironment();
  }
  const user = convex.watchQuery(api.Users.current, {});
  user.onUpdate(() => {
    try {
      const value = user.localQueryResult();
      account = value === undefined ? undefined : (value?.id ?? null);
    } catch {
      account = undefined;
    }
    update();
  });
  try {
    const value = user.localQueryResult();
    account = value === undefined ? undefined : (value?.id ?? null);
  } catch {
    account = undefined;
  }
  for (const event of ["online", "offline", "focus", "blur", "pageshow"])
    window.addEventListener(event, update);
  document.addEventListener("visibilitychange", update);
  window.addEventListener("pagehide", () => {
    ownership.update({
      ...environment(),
      participating: false,
      online: false,
      account,
    });
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
    void browserIdentity()
      .then((value) => {
        if (active) setIdentity(value);
      })
      .catch(() => {
        if (active)
          setSnapshot({
            ...emptySnapshot,
            error: "Presence requires browser storage and Web Locks",
          });
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
  const activities = useMemo(() => {
    const self = new Set(
      snapshot.members
        .filter((member) => member.guestId === identity?.guestId)
        .map((member) => member.id),
    );
    return snapshot.activities.filter(
      (activity) => !self.has(activity.participationId),
    );
  }, [snapshot.members, snapshot.activities, identity]);
  return {
    ...snapshot,
    activities,
    identity,
    emit: useCallback((event: InteractionEvent) => lease?.emit(event), [lease]),
  };
}
export type PresenceView = ReturnType<typeof usePresence>;
