import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useReactFlow, type NodeChange } from "@xyflow/react";
import {
  rectangleColors,
  rectangleLimits,
  type Geometry,
  type CanvasElement,
  type ElementId,
  type RectangleId,
  type DocumentElementId,
} from "@pluribus/core/canvas/domain";
import { createCanvasStore } from "./CanvasStore";
import type { DocumentNode } from "./DocumentNode";
import type { RectangleNode } from "./RectangleNode";
import type { InteractionEvent } from "@pluribus/core/presence/domain";
import { rectangleElement, documentElement } from "./ElementProjection";
import {
  geometryTarget,
  sendGeometry,
  type GeometryTarget,
} from "./GeometryMutations";
export type CanvasNode = RectangleNode | DocumentNode;

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
const getOnline = () => navigator.onLine;

export function useCanvas(emit: (event: InteractionEvent) => void) {
  const manipulation = useRef(new Map<string, "drag" | "resize">());
  const rectangleQuery = useRetainedQuery(api.Canvas.list, {});
  const cardQuery = useRetainedQuery(api.Canvas.documentCards, {});
  const rectangles = rectangleQuery.data;
  const cards = cardQuery.data;
  const queryFailed = rectangleQuery.failed || cardQuery.failed;
  const records: CanvasElement[] | undefined =
    rectangles && cards
      ? [...rectangles.map(rectangleElement), ...cards.map(documentElement)]
      : undefined;
  const geometryTargets = useRef(new Map<ElementId, GeometryTarget>());
  const pendingEditors = useRef(new Map<ElementId, boolean>());
  const changeDocument = useMutation(api.Canvas.changeDocument);
  const createDocument = useMutation(api.Canvas.createDocument);
  const update = useMutation(api.Canvas.updateGeometry);
  const create = useMutation(api.Canvas.create);
  const remove = useMutation(api.Canvas.remove);
  const connection = useConvexConnectionState();
  const online = useSyncExternalStore(subscribeOnline, getOnline);
  const connected =
    online &&
    connection.isWebSocketConnected &&
    records !== undefined &&
    !queryFailed;
  const [store] = useState(() =>
    createCanvasStore<ElementId>((id, geometry) =>
      sendGeometry(geometryTargets.current.get(id), geometry, {
        rectangle: update,
        document: changeDocument,
      }),
    ),
  );
  const { gestures, selected, removing, creating, error, editing, setEditing } =
    useStore(store);
  const pending = [...gestures.values()].filter(
    (g) => g.sending || g.queued,
  ).length;
  const [session] = useState(() => ({
    id: crypto.randomUUID(),
    color: rectangleColors[Math.floor(Math.random() * rectangleColors.length)],
  }));
  const surface = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<CanvasNode>();

  useEffect(() => {
    store.getState().setEnabled(connected);
    if (!connected) manipulation.current.clear();
    return () => store.getState().setEnabled(false);
  }, [connected, store]);
  useEffect(() => {
    if (!records) return;
    const ids = new Set(records.map((record) => record.id));
    store.getState().retain(ids);
    for (const [id, target] of geometryTargets.current) {
      const record = records.find((element) => element.id === id);
      if (
        !record ||
        (record.kind === "document" &&
          (record.removed ||
            target.kind !== "document" ||
            target.generation !== record.generation))
      ) {
        store.getState().cancel(id);
        geometryTargets.current.delete(id);
      }
    }
  }, [rectangles, cards, store]);

  const nodes: CanvasNode[] = (records ?? [])
    .filter((r) => r.kind === "document" || !removing.has(r.id))
    .map((r) => {
      const geometry = gestures.get(r.id)?.geometry ?? r.geometry;
      if (r.kind === "document")
        return {
          id: r.id,
          type: "document",
          position: { x: geometry.x, y: geometry.y },
          width: geometry.width,
          height: geometry.height,
          measured: { width: geometry.width, height: geometry.height },
          selected: selected.has(r.id),
          dragHandle: ".document-drag-handle",
          draggable: connected && !r.removed,
          data: {
            documentId: r.documentId as string as Id<"documents">,
            generation: r.generation,
            removed: r.removed,
            editable: connected,
            editing: editing === r.id,
            activate: (active: boolean) => setEditing(active ? r.id : null),
            pending: (value: boolean) => {
              pendingEditors.current.set(r.id, value);
            },
            restore: () => {
              void changeDocument({
                id: r.id as string as Id<"canvasDocuments">,
                generation: r.generation,
                change: { kind: "restore" },
              }).catch(() =>
                store.getState().finishCreate("Could not restore document."),
              );
            },
          },
          ariaLabel: "Document card",
        };
      return {
        id: r.id,
        type: "rectangle",
        position: { x: geometry.x, y: geometry.y },
        width: geometry.width,
        height: geometry.height,
        // Fixed-size rectangles have known measurements. Keeping them in the
        // controlled nodes lets React Flow initialize dragging after every update.
        measured: { width: geometry.width, height: geometry.height },
        selected: selected.has(r.id),
        data: { color: r.color, editable: connected },
        ariaLabel: `${r.color} rectangle`,
      };
    });

  function onNodesChange(changes: NodeChange<CanvasNode>[]) {
    store
      .getState()
      .select(changes.filter((change) => change.type === "select"));
    if (!connected) return;
    // A resize can change position and dimensions together. Assemble the entire
    // batch before sending so a top/left resize stays one atomic geometry update.
    const updates = new Map<
      ElementId,
      { geometry: Geometry; active: boolean }
    >();
    for (const change of changes) {
      if (change.type !== "position" && change.type !== "dimensions") continue;
      if (change.type === "dimensions" && change.resizing === undefined)
        continue;
      const record = records?.find((r) => r.id === change.id);
      if (
        !record ||
        removing.has(record.id) ||
        (record.kind === "document" && record.removed)
      )
        continue;
      const target = geometryTargets.current.get(record.id);
      if (
        record.kind === "document" &&
        target?.kind === "document" &&
        target.generation !== record.generation
      )
        store.getState().cancel(record.id);
      geometryTargets.current.set(record.id, geometryTarget(record));
      const base =
        updates.get(record.id)?.geometry ??
        store.getState().gestures.get(record.id)?.geometry ??
        record.geometry;
      const geometry = {
        x: base.x,
        y: base.y,
        width: base.width,
        height: base.height,
      };
      let active = updates.get(record.id)?.active ?? false;
      if (change.type === "position") {
        if (change.position) {
          geometry.x = change.position.x;
          geometry.y = change.position.y;
        }
        active = change.dragging ?? active;
      } else {
        if (change.dimensions) {
          geometry.width = change.dimensions.width;
          geometry.height = change.dimensions.height;
        }
        active = change.resizing ?? active;
      }
      updates.set(record.id, { geometry, active });
    }
    for (const [id, value] of updates) {
      store.getState().stage(id, value.geometry, value.active);
      if (value.active)
        manipulation.current.set(
          id,
          changes.some((c) => c.type === "dimensions" && c.id === id)
            ? "resize"
            : "drag",
        );
      else manipulation.current.delete(id);
    }
    if (updates.size)
      emit({
        type: "manipulation-changed",
        elements: [...manipulation.current.keys()],
        operation: manipulation.current.values().next().value ?? null,
      });
  }

  async function addRectangle() {
    if (!connected || !surface.current || !store.getState().beginCreate())
      return;
    const bounds = surface.current.getBoundingClientRect();
    const offset = ((records?.length ?? 0) % 5) * 24;
    const center = flow.screenToFlowPosition({
      x: bounds.left + bounds.width / 2 + offset,
      y: bounds.top + bounds.height / 2 + offset,
    });
    try {
      const id = await create({
        geometry: {
          x: center.x - 80,
          y: center.y - 50,
          width: 160,
          height: 100,
        },
        color: session.color,
      });
      store.getState().selectOnly(id as string as RectangleId);
      store.getState().finishCreate();
    } catch {
      store
        .getState()
        .finishCreate(
          `Could not add a rectangle. The canvas holds up to ${rectangleLimits.maxCount}; check the connection or delete one and try again.`,
        );
    }
  }

  async function addDocument() {
    if (!connected || !store.getState().beginCreate()) return;
    try {
      const id = await createDocument({
        geometry: {
          x: 80 + (cards?.length ?? 0) * 460,
          y: 80,
          width: 430,
          height: 500,
        },
      });
      store.getState().selectOnly(id as string as DocumentElementId);
      store.getState().finishCreate();
    } catch {
      store
        .getState()
        .finishCreate(
          "Could not add document. This experiment retains at most two cards; restore a removed card.",
        );
    }
  }
  async function deleteSelection() {
    if (!connected) return;
    const ids = (records ?? [])
      .filter((r) => selected.has(r.id) && !removing.has(r.id))
      .map((r) => r.id);
    if (!ids.length) return;
    if (ids.some((id) => pendingEditors.current.get(id))) {
      store
        .getState()
        .finishCreate("Wait for document edits to save before removal.");
      return;
    }
    setEditing(null);
    store.getState().beginRemove(ids);
    const results = await Promise.allSettled(
      ids.map((id) => {
        const record = records?.find((r) => r.id === id);
        return record?.kind === "document"
          ? changeDocument({
              id: record.id as string as Id<"canvasDocuments">,
              generation: record.generation,
              change: { kind: "remove" },
            })
          : remove({ id: id as string as Id<"rectangles"> });
      }),
    );
    store
      .getState()
      .finishRemove(
        ids,
        results.some((result) => result.status === "rejected")
          ? "Some elements could not be removed. Try again when connected."
          : undefined,
      );
  }

  return {
    nodes,
    addDocument,
    documentCount: cards?.length ?? 0,
    stopEditing: () => setEditing(null),
    onNodesChange,
    addRectangle,
    deleteSelection,
    connected,
    creating,
    selected,
    removing,
    pending,
    error: queryFailed
      ? "Canvas updates unavailable — editing paused. Keep this tab open to preserve unsaved text."
      : error,
    session,
    surface,
  };
}
