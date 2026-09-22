import type { SourceTable } from "../../sources/domain/Source";
import type { ElementId, RectangleColor } from "./Element";
import type { Geometry } from "./Geometry";

/** Protocol bounds; storage retention is deliberately a separate decision. */
export const historyLimits = {
  targets: 202,
  bytes: 128 * 1024,
  idleMs: 30_000,
  heartbeatMs: 10_000,
} as const;
export type ElementCreationInput =
  | { kind: "rectangle"; geometry: Geometry; color: RectangleColor }
  | { kind: "document"; geometry: Geometry }
  | {
      kind: "source";
      geometry: Geometry;
      url: string;
      prompt?: string;
      table?: SourceTable;
    };
export type CanvasActionInput =
  | { kind: "create"; element: ElementCreationInput }
  | { kind: "delete"; id: ElementId; generation: number };
export type HistoryGeometryUpdate = {
  id: ElementId;
  generation: number;
  geometry: Geometry;
};
export type HistoryTarget = { id: ElementId; lineage: string };
export type GeometryChange = HistoryTarget & {
  generation: number;
  before: Geometry;
  after: Geometry;
};
export type LifecyclePayload = HistoryTarget & {
  deletion: string | null;
  deletedGeneration: number | null;
};
export type ActionPayload =
  | ({ kind: "create" } & LifecyclePayload)
  | ({ kind: "delete" } & LifecyclePayload)
  | {
      kind: "geometry";
      changes: GeometryChange[];
      sequence: number;
      fingerprint: string;
      deadline: number;
    };
export type ActionState = "open" | "applied" | "undone" | "noop";
export type HistoryActionRecord = {
  action: string;
  version: 2;
  revision: number;
  state: ActionState;
  payload: ActionPayload;
};
export type HistoryOutcome = {
  status:
    "applied" | "noop" | "blocked" | "obsolete" | "rejected" | "reconcile";
  action: string;
  revision: number;
  id: ElementId | null;
  sequence: number;
  message: string | null;
};
export type GestureAck = {
  status: "accepted" | "superseded" | "closed" | "conflict";
  sequence: number;
};
/** This cursor advances only with this session's accepted lifecycle transitions. */
export type TargetContinuity = {
  lineage: string;
  generation: number;
  removed: boolean;
};

/** A known request/domain rejection; adapters distinguish it from uncertain infrastructure failure. */
export class HistoryProtocolError extends Error {}
