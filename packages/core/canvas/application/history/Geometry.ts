import {
  historyLimits,
  HistoryProtocolError,
  type GeometryChange,
  type HistoryActionRecord,
  type HistoryGeometryUpdate,
  type GestureAck,
} from "../../domain/History";
import {
  assertDocumentGeometry,
  assertElementGeometry,
} from "../../domain/Geometry";
import { sameGeometry } from "../GeometryHistory";
import { captureTarget, matchesTarget, saveTarget } from "./Continuity";
import type { HistoryPorts } from "./Ports";
import { outcome } from "./Results";

/** Close evidence, not geometry: a peer's later edit cannot erase an accepted gesture. */
export async function sealGesture(
  ports: HistoryPorts,
  record: HistoryActionRecord,
) {
  if (record.payload.kind !== "geometry")
    return outcome(record.action, "rejected", "Not a geometry action.");
  if (record.state === "open") {
    record = {
      ...record,
      revision: record.revision + 1,
      state: record.payload.changes.every((c) =>
        sameGeometry(c.before, c.after),
      )
        ? "noop"
        : "applied",
    };
    await ports.actions.save(record);
  }
  return {
    ...outcome(record.action, record.state === "noop" ? "noop" : "applied"),
    revision: record.revision,
    sequence: record.payload.kind === "geometry" ? record.payload.sequence : 0,
  };
}

/** One bounded latest-ACK cursor supports a single sender with one request in flight. */
export async function updateGesture(
  ports: HistoryPorts,
  action: string,
  sequence: number,
  fingerprint: string,
  updates: HistoryGeometryUpdate[],
): Promise<GestureAck> {
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    !updates.length ||
    updates.length > historyLimits.targets ||
    new Set(updates.map((u) => u.id)).size !== updates.length
  )
    throw new HistoryProtocolError("Invalid geometry sequence or targets");
  const previous = await ports.actions.get(action);
  if (previous && previous.payload.kind !== "geometry")
    throw new HistoryProtocolError("Action identity was reused");
  const payload =
    previous?.payload.kind === "geometry" ? previous.payload : null;
  if (
    payload &&
    (payload.changes.length !== updates.length ||
      payload.changes.some((c, i) => c.id !== updates[i].id))
  )
    throw new HistoryProtocolError("Gesture targets changed");
  // Historical acknowledgement precedes live eligibility checks, including expiry.
  if (payload && sequence === payload.sequence) {
    if (payload.fingerprint !== fingerprint)
      throw new HistoryProtocolError("Sequence identity was reused");
    return { status: "accepted", sequence };
  }
  if (payload && sequence < payload.sequence)
    return { status: "superseded", sequence: payload.sequence };
  if (
    previous &&
    payload &&
    (previous.state !== "open" || payload.deadline <= ports.now)
  ) {
    if (previous.state === "open") await sealGesture(ports, previous);
    return { status: "closed", sequence: payload.sequence };
  }
  if (sequence !== (payload?.sequence ?? 0) + 1)
    return { status: "conflict", sequence: payload?.sequence ?? 0 };
  const changes: GeometryChange[] = [];
  const elements = [];
  for (const [i, update] of updates.entries()) {
    const element = await ports.elements.get(update.id);
    if (!element || element.removed || element.generation !== update.generation)
      return { status: "conflict", sequence: payload?.sequence ?? 0 };
    (element.kind === "document"
      ? assertDocumentGeometry
      : assertElementGeometry)(update.geometry);
    const prior = payload?.changes[i];
    if (prior && prior.generation !== update.generation)
      return { status: "conflict", sequence: payload!.sequence };
    if (
      prior &&
      (!(await matchesTarget(ports, prior, element)) ||
        !sameGeometry(element.geometry, prior.after))
    )
      return { status: "conflict", sequence: payload?.sequence ?? 0 };
    const target = prior ?? (await captureTarget(ports, element, action));
    changes.push({
      id: target.id,
      lineage: target.lineage,
      generation: prior?.generation ?? element.generation,
      before: prior?.before ?? element.geometry,
      after: update.geometry,
    });
    elements.push(element);
  }
  for (const [i, change] of changes.entries()) {
    await ports.elements.geometry(change.id, change.after);
    if (!previous)
      await saveTarget(
        ports,
        change.id,
        change.lineage,
        elements[i].generation,
        false,
      );
  }
  const deadline = ports.now + historyLimits.idleMs;
  await ports.actions.save({
    action,
    version: 2,
    revision: 0,
    state: "open",
    payload: { kind: "geometry", changes, sequence, fingerprint, deadline },
  });
  if (!previous) await ports.schedule(action, deadline);
  return { status: "accepted", sequence };
}
export async function reverseGeometry(
  ports: HistoryPorts,
  record: HistoryActionRecord,
  undo: boolean,
) {
  if (record.payload.kind !== "geometry")
    throw new HistoryProtocolError("Invalid geometry action");
  for (const change of record.payload.changes) {
    const element = await ports.elements.get(change.id);
    if (
      !element ||
      element.removed ||
      !(await matchesTarget(ports, change, element)) ||
      !sameGeometry(element.geometry, undo ? change.after : change.before)
    )
      return outcome(
        record.action,
        "obsolete",
        "An Element changed after this gesture.",
      );
  }
  for (const change of record.payload.changes)
    await ports.elements.geometry(
      change.id,
      undo ? change.before : change.after,
    );
  const saved = {
    ...record,
    revision: record.revision + 1,
    state: undo ? ("undone" as const) : ("applied" as const),
  };
  await ports.actions.save(saved);
  return {
    ...outcome(record.action, "applied"),
    revision: saved.revision,
    sequence: record.payload.sequence,
  };
}
