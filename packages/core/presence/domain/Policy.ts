import type { Activity, Channel } from "./Activity";

export type Environment = {
  online: boolean;
  visible: boolean;
  focused: boolean;
};
export type InteractionEvent =
  | { type: "pointer-moved"; point: { x: number; y: number } }
  | { type: "pointer-left" }
  | { type: "selection-changed"; elements: string[] }
  | {
      type: "manipulation-changed";
      elements: string[];
      operation: "drag" | "resize" | null;
    }
  | {
      type: "text-selection-changed";
      focused: boolean;
      range: Extract<Activity, { kind: "text" }>["range"];
    }
  | { type: "editor-focused" }
  | { type: "editor-blurred" };
export type PresenceEvent =
  | { type: "environment-changed"; environment: Environment }
  | { type: "surface-acquired"; owner: object }
  | { type: "surface-released"; owner: object }
  | { type: "interaction"; owner: object; event: InteractionEvent }
  | { type: "participation-ended" };
export type PresenceState = {
  environment: Environment;
  surfaces: ReadonlySet<object>;
  editorFocus: ReadonlyMap<object, boolean>;
  owners: ReadonlyMap<Channel, object>;
  activities: ReadonlyMap<Channel, Activity>;
};
export function initialPresenceState(environment: Environment): PresenceState {
  return {
    environment,
    surfaces: new Set(),
    editorFocus: new Map(),
    owners: new Map(),
    activities: new Map(),
  };
}
/** Membership intent is separate from focus and the last observed activity. */
export function membershipIntent(state: PresenceState) {
  if (!state.environment.online || !state.surfaces.size) return "absent";
  return state.environment.visible ? "present" : "away";
}
function clearActivity(kind: Channel): Activity {
  switch (kind) {
    case "pointer":
      return { kind, point: null };
    case "selection":
      return { kind, elements: [] };
    case "manipulation":
      return { kind, elements: [], operation: null };
    case "text":
      return { kind, range: null };
  }
}
/** Pure policy: adapters report facts; only this transition chooses activity clears. */
export function transitionPresence(
  state: PresenceState,
  event: PresenceEvent,
): PresenceState {
  switch (event.type) {
    case "environment-changed":
      return { ...state, environment: event.environment };
    case "participation-ended":
      return { ...state, owners: new Map(), activities: new Map() };
    case "surface-acquired":
      return { ...state, surfaces: new Set([...state.surfaces, event.owner]) };
    case "surface-released": {
      const surfaces = new Set(state.surfaces),
        owners = new Map(state.owners),
        activities = new Map(state.activities),
        editorFocus = new Map(state.editorFocus);
      surfaces.delete(event.owner);
      editorFocus.delete(event.owner);
      for (const [channel, owner] of owners)
        if (owner === event.owner) {
          owners.delete(channel);
          activities.set(channel, clearActivity(channel));
        }
      return { ...state, surfaces, owners, activities, editorFocus };
    }
    case "interaction": {
      if (!state.surfaces.has(event.owner)) return state;
      const fact = event.event;
      if (fact.type === "editor-focused" || fact.type === "editor-blurred") {
        return {
          ...state,
          editorFocus: new Map(state.editorFocus).set(
            event.owner,
            fact.type === "editor-focused",
          ),
        };
      }
      if (membershipIntent(state) !== "present") return state;
      let activity: Activity;
      switch (fact.type) {
        case "pointer-moved":
          activity = { kind: "pointer", point: fact.point };
          break;
        case "pointer-left":
          if (!state.environment.focused) return state;
          activity = clearActivity("pointer");
          break;
        case "selection-changed":
          activity = { kind: "selection", elements: fact.elements };
          break;
        case "manipulation-changed":
          activity = {
            kind: "manipulation",
            elements: fact.elements,
            operation: fact.operation,
          };
          break;
        case "text-selection-changed":
          if (!fact.focused) return state;
          activity = { kind: "text", range: fact.range };
          break;
      }
      return {
        ...state,
        owners: new Map(state.owners).set(activity.kind, event.owner),
        activities: new Map(state.activities).set(activity.kind, activity),
      };
    }
  }
}
