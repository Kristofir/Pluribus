import { sourceLimits } from "../../../sources/domain/Source";
import { documentLimits } from "../../domain/Document";
import type {
  CanvasActionInput,
  HistoryActionRecord,
  LifecyclePayload,
} from "../../domain/History";
import {
  assertDocumentGeometry,
  assertSourceGeometry,
  assertElementGeometry,
} from "../../domain/Geometry";
import { rectangleLimits } from "../../domain/Rectangle";
import { captureTarget, matchesTarget, saveTarget } from "./Continuity";
import type { HistoryPorts } from "./Ports";
import { outcome } from "./Results";

const capacity = (kind: "rectangle" | "document" | "source") =>
  kind === "rectangle"
    ? rectangleLimits.maxCount
    : kind === "source"
      ? sourceLimits.maxCount
      : documentLimits.maxCount;
/** Fresh lifecycle actions capture authoritative continuity and retain canonical content. */
export async function applyLifecycle(
  ports: HistoryPorts,
  action: string,
  input: CanvasActionInput,
  deletion: string,
) {
  let payload: HistoryActionRecord["payload"];
  if (input.kind === "create") {
    (input.element.kind === "document"
      ? assertDocumentGeometry
      : input.element.kind === "source"
        ? assertSourceGeometry
        : assertElementGeometry)(input.element.geometry);
    if (
      (await ports.elements.count(input.element.kind)) >=
      capacity(input.element.kind)
    )
      return outcome(action, "blocked", "This Element type is at capacity.");
    const id = await ports.elements.create(input.element);
    await saveTarget(ports, id, action, 1, false);
    payload = {
      kind: "create",
      id,
      lineage: action,
      deletion: null,
      deletedGeneration: null,
    };
  } else {
    const element = await ports.elements.get(input.id);
    if (!element || element.removed || element.generation !== input.generation)
      return outcome(action, "obsolete", "The Element changed lifecycle.");
    const target = await captureTarget(ports, element, action);
    const generation = element.generation + 1;
    await ports.elements.lifecycle(element.id, true, generation, deletion);
    await saveTarget(ports, element.id, target.lineage, generation, true);
    payload = {
      kind: "delete",
      ...target,
      deletion,
      deletedGeneration: generation,
    };
  }
  const record: HistoryActionRecord = {
    action,
    version: 2,
    revision: 1,
    state: "applied",
    payload,
  };
  await ports.actions.save(record);
  return { ...outcome(action, "applied"), revision: 1, id: payload.id };
}
/** Inverses can advance this session's generation, but cannot repair stale lineage. */
export async function reverseLifecycle(
  ports: HistoryPorts,
  record: HistoryActionRecord,
  payload: LifecyclePayload & { kind: "create" | "delete" },
  undo: boolean,
  deletion: string,
) {
  const element = await ports.elements.get(payload.id);
  if (!element || !(await matchesTarget(ports, payload, element)))
    return outcome(
      record.action,
      "obsolete",
      "Another session changed this Element's lifecycle.",
    );
  const removing = payload.kind === "create" ? undo : !undo;
  if (
    removing
      ? element.removed
      : !element.removed ||
        !payload.deletion ||
        element.activeDeletion !== payload.deletion ||
        element.generation !== payload.deletedGeneration
  )
    return outcome(
      record.action,
      "obsolete",
      "The Element no longer matches this lifecycle action.",
    );
  if (
    !removing &&
    (await ports.elements.count(element.kind)) >= capacity(element.kind)
  )
    return outcome(
      record.action,
      "blocked",
      "This Element type is at capacity. Try again when space opens.",
    );
  const generation = element.generation + 1;
  await ports.elements.lifecycle(
    element.id,
    removing,
    generation,
    removing ? deletion : null,
  );
  await saveTarget(ports, element.id, payload.lineage, generation, removing);
  const saved = {
    ...record,
    revision: record.revision + 1,
    state: undo ? ("undone" as const) : ("applied" as const),
    payload: {
      ...payload,
      deletion: removing ? deletion : null,
      deletedGeneration: removing ? generation : null,
    },
  };
  await ports.actions.save(saved);
  return {
    ...outcome(record.action, "applied"),
    revision: saved.revision,
    id: element.id,
  };
}
