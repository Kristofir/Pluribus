import { createStore } from "zustand/vanilla";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@pluribus/backend/api";
import {
  contextKey,
  presenceParameters,
  type Activity,
  initialPresenceState,
  membershipIntent,
  transitionPresence,
  type Environment,
  type InteractionEvent,
  type PresenceEvent,
} from "@pluribus/core/presence/domain";
import { createActivityQueue } from "./ActivityQueue";
export type Context = FunctionArgs<typeof api.Presence.join>["context"];
export type Credentials = FunctionReturnType<typeof api.Presence.join>;
export type Member = FunctionReturnType<typeof api.Presence.roster>[number];
export type RemoteActivity = FunctionReturnType<
  typeof api.Presence.activities
>[number];
export type Identity = {
  guestId: string;
  tabId: string;
  name: string;
  color: string;
};
export interface Transport {
  join(context: Context, identity: Identity): Promise<Credentials>;
  leave(context: Context, credentials: Credentials): Promise<unknown>;
  unload?(context: Context, credentials: Credentials): void;
  heartbeat(context: Context, credentials: Credentials): Promise<boolean>;
  lifecycle(
    context: Context,
    credentials: Credentials,
    sequence: number,
    hidden: boolean,
    focused: boolean,
  ): Promise<unknown>;
  publish(
    context: Context,
    credentials: Credentials,
    activity: Activity,
    sequence: number,
  ): Promise<unknown>;
  watch(
    context: Context,
    kind: "roster" | "activities",
    changed: () => void,
  ): {
    read: () => Member[] | RemoteActivity[] | undefined;
    dispose: () => void;
  };
}
export const emptySnapshot = {
  members: [] as Member[],
  activities: [] as RemoteActivity[],
  id: null as Credentials["id"] | null,
  error: null as string | null,
  show: true,
};
export function createPresenceRegistry(
  transport: Transport,
  identity: Promise<Identity>,
) {
  let environment: Environment = {
    online: false,
    visible: true,
    focused: true,
  };
  const entries = new Map<string, ReturnType<typeof entry>>();
  function entry(context: Context) {
    let state = initialPresenceState(environment);
    const present = () => membershipIntent(state) === "present";
    const ui = createStore(() => ({
      id: null as Credentials["id"] | null,
      error: null as string | null,
      show: true,
    }));
    const listeners = new Set<() => void>();
    let snapshot = emptySnapshot,
      credentials: Credentials | null = null,
      generation = 0,
      lifecycleSequence = 0;
    let joining = false,
      heartbeatBusy = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let queue: ReturnType<typeof createActivityQueue> | null = null;
    function changed() {
      try {
        snapshot = {
          ...ui.getState(),
          members: (roster.read() ?? []) as Member[],
          activities: (activities.read() ?? []) as RemoteActivity[],
        };
      } catch {
        snapshot = { ...snapshot, error: "Presence unavailable" };
      }
      for (const listener of listeners) listener();
    }
    const roster = transport.watch(context, "roster", () => changed());
    const activities = transport.watch(context, "activities", () => changed());
    const unsubscribe = ui.subscribe(changed);
    function fail() {
      ui.setState({ error: "Presence unavailable — retrying" });
    }
    function dispatch(event: PresenceEvent) {
      const previous = state;
      state = transitionPresence(state, event);
      if (present())
        for (const [kind, activity] of state.activities)
          if (previous.activities.get(kind) !== activity)
            queue?.publish(activity);
    }
    function discard() {
      generation++;
      queue?.dispose();
      queue = null;
      dispatch({ type: "participation-ended" });
      const old = credentials;
      credentials = null;
      ui.setState({ id: null });
      if (old) void transport.leave(context, old).catch(() => {});
    }
    async function start() {
      if (joining || credentials || !present()) return;
      joining = true;
      const epoch = generation;
      try {
        const who = await identity;
        if (epoch !== generation) return;
        const value = await transport.join(context, who);
        if (epoch !== generation || !present()) {
          void transport.leave(context, value).catch(() => {});
          return;
        }
        credentials = value;
        ui.setState({ id: value.id, error: null });
        queue = createActivityQueue(async (activity, sequence) => {
          const accepted = await transport.publish(
            context,
            value,
            activity,
            sequence,
          );
          if (credentials !== value) return;
          if (accepted === false) {
            // A publish already in flight can be rejected after the tab hides.
            // Keep that away membership until expiry or the next visible join.
            if (present()) {
              discard();
              void start();
            }
          } else ui.setState({ error: null });
        }, fail);
        for (const activity of state.activities.values())
          queue.publish(activity);
        await transport.lifecycle(
          context,
          value,
          ++lifecycleSequence,
          false,
          state.environment.focused,
        );
      } catch {
        if (epoch === generation) fail();
      } finally {
        joining = false;
        if (!credentials && present() && epoch !== generation) void start();
      }
    }
    async function beat() {
      if (!present()) return;
      if (!credentials) {
        void start();
        return;
      }
      if (heartbeatBusy) return;
      const value = credentials;
      heartbeatBusy = true;
      try {
        if (!(await transport.heartbeat(context, value))) {
          if (credentials === value) {
            discard();
            void start();
          }
        }
      } catch {
        if (credentials === value) {
          discard();
          fail();
        }
      } finally {
        heartbeatBusy = false;
      }
    }
    const timer = setInterval(
      () => void beat(),
      presenceParameters.heartbeatMs,
    );
    function updateEnvironment(next: Environment) {
      const before = membershipIntent(state);
      dispatch({ type: "environment-changed", environment: next });
      const after = membershipIntent(state);
      if (after === "absent") {
        if (before !== "absent") discard();
        return;
      }
      if (after === "away") {
        queue?.dispose();
        queue = null;
        if (credentials && before === "present")
          void transport
            .lifecycle(
              context,
              credentials,
              ++lifecycleSequence,
              true,
              next.focused,
            )
            .catch(fail);
        return;
      }
      if (before !== "present") {
        discard();
        void start();
      } else if (credentials)
        void transport
          .lifecycle(
            context,
            credentials,
            ++lifecycleSequence,
            false,
            next.focused,
          )
          .catch(fail);
    }
    return {
      acquire() {
        clearTimeout(closeTimer);
        const owner = {};
        dispatch({ type: "surface-acquired", owner });
        void start();
        let released = false;
        return {
          emit(event: InteractionEvent) {
            if (!released) dispatch({ type: "interaction", owner, event });
          },
          release() {
            if (released) return;
            released = true;
            // Send owned-channel clears before the final leave grace period.
            const previous = state;
            state = transitionPresence(state, {
              type: "surface-released",
              owner,
            });
            for (const [kind, activity] of state.activities)
              if (previous.activities.get(kind) !== activity)
                queue?.publish(activity);
            if (!state.surfaces.size)
              closeTimer = setTimeout(() => {
                discard();
                clearInterval(timer);
                roster.dispose();
                activities.dispose();
                unsubscribe();
                entries.delete(contextKey(context));
              }, 150);
          },
        };
      },
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getSnapshot: () => snapshot,
      toggle: () => ui.setState({ show: !ui.getState().show }),
      updateEnvironment,
      unload() {
        if (credentials) transport.unload?.(context, credentials);
        discard();
      },
    };
  }
  return {
    acquire(context: Context) {
      const key = contextKey(context);
      let resource = entries.get(key);
      if (!resource) {
        resource = entry(context);
        entries.set(key, resource);
      }
      const lease = resource.acquire();
      return {
        ...lease,
        subscribe: resource.subscribe,
        getSnapshot: resource.getSnapshot,
        toggle: resource.toggle,
      };
    },
    emit(
      event:
        | { type: "environment-changed"; environment: Environment }
        | { type: "page-exited" },
    ) {
      if (event.type === "page-exited") {
        for (const resource of entries.values()) resource.unload();
        environment = { online: false, visible: false, focused: false };
      } else {
        const next = event.environment;
        if (
          environment.online === next.online &&
          environment.visible === next.visible &&
          environment.focused === next.focused
        )
          return;
        environment = next;
      }
      for (const resource of entries.values())
        resource.updateEnvironment(environment);
    },
  };
}
