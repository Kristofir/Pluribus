import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@pluribus/backend/api";

/** The coordinator owns this protocol; components only send user actions. */
export type HistoryTransport = {
  open(
    args: FunctionArgs<typeof api.Canvas.openHistorySession>,
  ): Promise<FunctionReturnType<typeof api.Canvas.openHistorySession>>;
  apply(
    args: FunctionArgs<typeof api.Canvas.applyHistoryAction>,
  ): Promise<FunctionReturnType<typeof api.Canvas.applyHistoryAction>>;
  reverse(
    args: FunctionArgs<typeof api.Canvas.reverseHistoryAction>,
  ): Promise<FunctionReturnType<typeof api.Canvas.reverseHistoryAction>>;
  update(
    args: FunctionArgs<typeof api.Canvas.updateHistoryGesture>,
  ): Promise<FunctionReturnType<typeof api.Canvas.updateHistoryGesture>>;
  close(
    args: FunctionArgs<typeof api.Canvas.closeHistoryGesture>,
  ): Promise<FunctionReturnType<typeof api.Canvas.closeHistoryGesture>>;
  heartbeat(
    args: FunctionArgs<typeof api.Canvas.heartbeatHistoryGesture>,
  ): Promise<boolean>;
  token(): string;
};
export type ActionInput = FunctionArgs<
  typeof api.Canvas.applyHistoryAction
>["input"];
export type GeometryUpdate = FunctionArgs<
  typeof api.Canvas.updateHistoryGesture
>["updates"][number];
export type GeometryBatch = Pick<
  FunctionArgs<typeof api.Canvas.updateHistoryGesture>,
  "action" | "sequence" | "updates"
>;
export type ActionOutcome = FunctionReturnType<
  typeof api.Canvas.applyHistoryAction
>;
export type ActionEntry = {
  action: string;
  revision: number;
  attempt: string;
} & (
  | {
      kind: "create";
      input: Extract<ActionInput, { kind: "create" }>;
      id?: NonNullable<ActionOutcome["id"]>;
    }
  | {
      kind: "delete";
      input: Extract<ActionInput, { kind: "delete" }>;
      id: NonNullable<ActionOutcome["id"]>;
    }
  | {
      kind: "geometry";
      sequence: number;
      pendingUpdate?: GeometryBatch;
      closeRequest?: { attempt: string; sequence: number };
    }
);
