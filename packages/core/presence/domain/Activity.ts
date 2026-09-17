export type PresenceContext =
  { kind: "canvas"; id: string } | { kind: "document"; id: string };
export type Activity =
  | { kind: "pointer"; point: { x: number; y: number } | null }
  | { kind: "selection"; elements: string[] }
  | {
      kind: "manipulation";
      elements: string[];
      operation: "drag" | "resize" | null;
    }
  | {
      kind: "text";
      range: { version: number; anchor: number; head: number } | null;
    };
export type Channel = Activity["kind"];
export const presenceParameters = {
  heartbeatMs: 10_000,
  activityMs: 80,
  maxSessions: 64,
  maxElements: 200,
} as const;
export function contextKey(context: PresenceContext) {
  return `${context.kind}:${context.id}`;
}
export function guestProfile(id: string) {
  let hash = 0;
  for (const c of id) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  const names = [
    "Amber",
    "Cedar",
    "Coral",
    "Indigo",
    "Maple",
    "River",
    "Sage",
    "Willow",
  ];
  const colors = [
    "#b45309",
    "#047857",
    "#be123c",
    "#4338ca",
    "#a21caf",
    "#0369a1",
    "#4d7c0f",
    "#7e22ce",
  ];
  return {
    name: `${names[hash % names.length]} ${id.slice(0, 4)}`,
    color: colors[hash % colors.length],
  };
}
export function assertActivity(
  context: PresenceContext,
  activity: Activity,
  sequence: number,
) {
  if (!Number.isSafeInteger(sequence) || sequence < 0)
    throw new Error("Invalid activity sequence");
  if ((context.kind === "document") !== (activity.kind === "text"))
    throw new Error("Activity does not belong to this context");
  if (
    activity.kind === "pointer" &&
    activity.point &&
    ![activity.point.x, activity.point.y].every(
      (n) => Number.isFinite(n) && Math.abs(n) <= 1_000_000,
    )
  )
    throw new Error("Invalid pointer");
  if (activity.kind === "selection" || activity.kind === "manipulation") {
    if (
      activity.elements.length > presenceParameters.maxElements ||
      new Set(activity.elements).size !== activity.elements.length ||
      activity.elements.some((id) => !id || id.length > 128)
    )
      throw new Error("Invalid element selection");
    if (
      activity.kind === "manipulation" &&
      activity.operation === null &&
      activity.elements.length
    )
      throw new Error("Ended manipulation must be empty");
  }
  if (
    activity.kind === "text" &&
    activity.range &&
    !Object.values(activity.range).every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000,
    )
  )
    throw new Error("Invalid text range");
  if (activity.kind === "text" && activity.range?.version === 0)
    throw new Error("Invalid document version");
}
export function isClear(activity: Activity) {
  switch (activity.kind) {
    case "pointer":
      return activity.point === null;
    case "selection":
      return activity.elements.length === 0;
    case "manipulation":
      return activity.operation === null;
    case "text":
      return activity.range === null;
  }
}

export {
  initialPresenceState,
  membershipIntent,
  transitionPresence,
} from "./Policy";
export type { Environment, InteractionEvent, PresenceEvent } from "./Policy";
