import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { api } from "@pluribus/backend/api";
import { useReactFlow, type NodeChange } from "@xyflow/react";
import { AlignmentGesture, type AlignmentGuide } from "./AlignmentGesture";
import {
  rectangleColors,
  geometryLimits,
  type Geometry,
  type CanvasElement,
  type ElementId,
} from "@pluribus/core/canvas/domain";
import { createCanvasStore } from "./CanvasStore";
import { createCanvasNodeProjector, type CanvasNode } from "./CanvasNodes";
import { useCanvasCommands } from "./UseCanvasCommands";
import { useSnapAnimation } from "./UseSnapAnimation";
import type { InteractionEvent } from "@pluribus/core/presence/domain";
import { rectangleElement, documentElement } from "./ElementProjection";
import {
  geometryTarget,
  sendGeometry,
  type GeometryTarget,
} from "./GeometryMutations";
export type { CanvasNode } from "./CanvasNodes";

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
  const flow = useReactFlow();
  const alignment = useRef<AlignmentGesture | null>(null);
  const altPressed = useRef(false);
  const reapplyAlignment = useRef<() => void>(() => {});
  const finishAlignment = useRef<() => void>(() => {});
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  useEffect(() => {
    const modifiers = (event: KeyboardEvent | MouseEvent | PointerEvent) => {
      const changed = altPressed.current !== event.altKey;
      altPressed.current = event.altKey;
      if (changed) reapplyAlignment.current();
    };
    const clear = () => {
      finishAlignment.current();
      alignment.current = null;
      altPressed.current = false;
      setAlignmentGuides([]);
    };
    window.addEventListener("keydown", modifiers, true);
    window.addEventListener("keyup", modifiers, true);
    window.addEventListener("mousemove", modifiers, true);
    window.addEventListener("pointermove", modifiers, true);
    window.addEventListener("pointercancel", clear);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", modifiers, true);
      window.removeEventListener("keyup", modifiers, true);
      window.removeEventListener("mousemove", modifiers, true);
      window.removeEventListener("pointermove", modifiers, true);
      window.removeEventListener("pointercancel", clear);
      window.removeEventListener("blur", clear);
    };
  }, []);
  const manipulation = useRef(new Map<string, "drag" | "resize">());
  const rectangleQuery = useRetainedQuery(api.Canvas.list, {});
  const cardQuery = useRetainedQuery(api.Canvas.documentCards, {});
  const rectangles = rectangleQuery.data;
  const cards = cardQuery.data;
  const queryFailed = rectangleQuery.failed || cardQuery.failed;
  const records = useMemo<CanvasElement[] | undefined>(
    () =>
      rectangles && cards
        ? [...rectangles.map(rectangleElement), ...cards.map(documentElement)]
        : undefined,
    [rectangles, cards],
  );
  const recordsRef = useRef(records);
  useLayoutEffect(() => {
    recordsRef.current = records;
  }, [records]);
  const contentHeights = useRef(
    new Map<ElementId, { generation: number; height: number }>(),
  );
  const geometryTargets = useRef(new Map<ElementId, GeometryTarget>());
  const pendingEditors = useRef(new Map<ElementId, boolean>());
  const changeDocument = useMutation(api.Canvas.changeDocument);
  const update = useMutation(api.Canvas.updateGeometry);
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
  const state = useStore(
    store,
    useShallow(({ gestures, selected, removing, editing, setEditing }) => ({
      gestures,
      selected,
      removing,
      editing,
      setEditing,
    })),
  );
  const { gestures, selected, removing, setEditing } = state;
  const pending = [...gestures.values()].filter(
    (g) => g.sending || g.queued,
  ).length;
  const [session] = useState(() => ({
    id: crypto.randomUUID(),
    color: rectangleColors[Math.floor(Math.random() * rectangleColors.length)],
  }));
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    store.getState().setEnabled(connected);
    if (!connected) {
      manipulation.current.clear();
      alignment.current = null;
      setAlignmentGuides([]);
    }
    return () => store.getState().setEnabled(false);
  }, [connected, store]);
  useEffect(() => {
    if (!records) return;
    const ids = new Set(records.map((record) => record.id));
    store.getState().retain(ids);
    if (
      alignment.current &&
      [...alignment.current.initial.keys()].some((id) => !ids.has(id))
    ) {
      alignment.current = null;
      setAlignmentGuides([]);
    }
    for (const id of contentHeights.current.keys())
      if (!ids.has(id)) contentHeights.current.delete(id);
    if (
      store.getState().editing &&
      ![...ids].includes(store.getState().editing as ElementId)
    )
      store.getState().setEditing(null);
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
        if (alignment.current?.initial.has(id)) {
          alignment.current = null;
          setAlignmentGuides([]);
        }
        geometryTargets.current.delete(id);
      }
    }
  }, [rectangles, cards, store]);

  const {
    addRectangle,
    addDocument,
    deleteSelection,
    history,
    undoDocument,
    redoDocument,
  } = useCanvasCommands({
    connected,
    records,
    documentCount: cards?.length ?? 0,
    store,
    pendingEditors,
    surface,
    color: session.color,
  });
  const [projectNodes] = useState(createCanvasNodeProjector);
  const reportPending = useCallback((id: ElementId, value: boolean) => {
    pendingEditors.current.set(id, value);
  }, []);
  const reportContentHeight = useCallback(
    (id: ElementId, generation: number, height: number) => {
      if (!Number.isFinite(height)) return;
      const record = recordsRef.current?.find((record) => record.id === id);
      if (
        record?.kind !== "document" ||
        record.removed ||
        record.generation !== generation
      )
        return;
      contentHeights.current.set(id, { generation, height });
      const current = store.getState();
      if (!current.enabled || current.removing.has(id)) return;
      const gesture = current.gestures.get(id);
      const geometry = gesture?.geometry ?? record.geometry;
      if (geometry.height >= height) return;
      geometryTargets.current.set(id, geometryTarget(record));
      current.stage(id, { ...geometry, height }, gesture?.active ?? false);
    },
    [store],
  );
  const nodes = projectNodes(records, state, connected, {
    pending: reportPending,
    contentHeight: reportContentHeight,
  });
  const snapAnimation = useSnapAnimation(surface, nodes, connected);
  const stopEditing = useCallback(() => setEditing(null), [setEditing]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      store
        .getState()
        .select(changes.filter((change) => change.type === "select"));
      if (!connected) return;
      const moving = changes.filter(
        (change) =>
          (change.type === "position" && change.dragging === true) ||
          (change.type === "dimensions" && change.resizing === true),
      );
      if (!alignment.current && moving.length) {
        const movingIds = new Set(
          moving.flatMap((change) => ("id" in change ? [change.id] : [])),
        );
        const current = store.getState();
        const initial = new Map<ElementId, Geometry>();
        const targets = [];
        for (const record of records ?? []) {
          if (
            current.removing.has(record.id) ||
            (record.kind === "document" && record.removed)
          )
            continue;
          const geometry = {
            ...(current.gestures.get(record.id)?.geometry ?? record.geometry),
          };
          if (movingIds.has(record.id)) initial.set(record.id, geometry);
          else targets.push({ id: record.id, geometry });
        }
        if (initial.size)
          alignment.current = new AlignmentGesture(
            initial,
            targets,
            moving.some((change) => change.type === "dimensions"),
          );
      }
      // A resize can change position and dimensions together. Assemble the entire
      // batch before sending so a top/left resize stays one atomic geometry update.
      const updates = new Map<
        ElementId,
        { geometry: Geometry; active: boolean }
      >();
      for (const change of changes) {
        if (change.type !== "position" && change.type !== "dimensions")
          continue;
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
          alignment.current?.candidates.get(record.id) ??
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
        const minimum = contentHeights.current.get(record.id);
        if (
          record.kind === "document" &&
          minimum?.generation === record.generation
        )
          geometry.height = Math.max(geometry.height, minimum.height);
        updates.set(record.id, { geometry, active });
      }
      if (alignment.current && updates.size) {
        const gesture = alignment.current;
        const first = records?.find((record) => gesture.initial.has(record.id));
        const minimum = first && contentHeights.current.get(first.id);
        const resizing = gesture.resizing;
        const guides = gesture.resolve(
          updates,
          flow.getZoom(),
          altPressed.current,
          {
            minWidth: resizing
              ? first?.kind === "document"
                ? 360
                : geometryLimits.minSize
              : 0,
            minHeight: resizing
              ? Math.max(
                  geometryLimits.minSize,
                  first?.kind === "document" &&
                    minimum?.generation === first.generation
                    ? minimum.height
                    : 0,
                )
              : 0,
            maxWidth: resizing ? geometryLimits.maxSize : Infinity,
            maxHeight:
              resizing && first?.kind === "rectangle"
                ? geometryLimits.maxSize
                : Infinity,
            minX: -geometryLimits.maxCoordinate,
            maxX: geometryLimits.maxCoordinate,
            minY: -geometryLimits.maxCoordinate,
            maxY: geometryLimits.maxCoordinate,
          },
        );
        const active = [...updates.values()].some((value) => value.active);
        if (gesture.motion)
          for (const [id, value] of updates)
            snapAnimation.current.set(id, {
              delta: gesture.motion,
              geometry: value.geometry,
            });
        setAlignmentGuides(active ? guides : []);
        if (!active) alignment.current = null;
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
    },
    [store, connected, records, removing, emit, flow, snapAnimation],
  );

  useLayoutEffect(() => {
    finishAlignment.current = () => {
      const gesture = alignment.current;
      if (!gesture) return;
      for (const id of gesture.initial.keys()) {
        const current = store.getState().gestures.get(id);
        if (current) store.getState().stage(id, current.geometry, false);
        manipulation.current.delete(id);
      }
      emit({ type: "manipulation-changed", elements: [], operation: null });
    };
    reapplyAlignment.current = () => {
      const gesture = alignment.current;
      if (!gesture) return;
      const changes: NodeChange<CanvasNode>[] = [];
      for (const [id, geometry] of gesture.candidates) {
        changes.push({
          id,
          type: "position",
          position: { x: geometry.x, y: geometry.y },
          dragging: !gesture.resizing,
        });
        if (gesture.resizing)
          changes.push({
            id,
            type: "dimensions",
            dimensions: { width: geometry.width, height: geometry.height },
            resizing: true,
          });
      }
      onNodesChange(changes);
    };
  }, [onNodesChange, store, emit]);

  return {
    alignmentGuides,
    store,
    queryFailed,
    nodes,
    addDocument,
    documentCount: cards?.length ?? 0,
    stopEditing,
    onNodesChange,
    addRectangle,
    deleteSelection,
    history,
    undoDocument,
    redoDocument,
    connected,
    selected,
    removing,
    pending,
    session,
    surface,
  };
}
