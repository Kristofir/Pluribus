import type { CanvasElement, ElementId, Geometry } from "../../domain/Index";
import type {
  ElementCreationInput,
  HistoryActionRecord,
  HistoryOutcome,
  TargetContinuity,
} from "../../domain/History";

export type HistoryElement = Pick<
  CanvasElement,
  "id" | "kind" | "generation" | "removed" | "geometry"
> & { activeDeletion: string | null };
/** All writes and evidence supplied here share the adapter's transaction and authenticated session. */
export interface HistoryPorts {
  elements: {
    get(id: ElementId): Promise<HistoryElement | null>;
    create(input: ElementCreationInput): Promise<ElementId>;
    count(kind: CanvasElement["kind"]): Promise<number>;
    geometry(id: ElementId, geometry: Geometry): Promise<void>;
    lifecycle(
      id: ElementId,
      removed: boolean,
      generation: number,
      deletion: string | null,
    ): Promise<void>;
  };
  actions: {
    get(action: string): Promise<HistoryActionRecord | null>;
    save(record: HistoryActionRecord): Promise<void>;
  };
  targets: {
    get(id: ElementId): Promise<TargetContinuity | null>;
    save(id: ElementId, value: TargetContinuity): Promise<void>;
  };
  attempts: {
    get(
      attempt: string,
    ): Promise<{ fingerprint: string; outcome: HistoryOutcome } | null>;
    save(
      attempt: string,
      fingerprint: string,
      outcome: HistoryOutcome,
    ): Promise<void>;
  };
  schedule(action: string, deadline: number): Promise<void>;
  now: number;
}
