import { arrangeElements, type Arrangement } from "./ArrangeElements";
import { useCanvasScope } from "./CanvasScope";
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
import { AlignmentGesture } from "./AlignmentGesture";
import {
  geometryLimits,
  type Geometry,
  type CanvasElement,
  type ElementId,
  type ImageElementId,
} from "@pluribus/core/canvas/domain";
import { createCanvasStore } from "./CanvasStore";
import { createCanvasNodeProjector, type CanvasNode } from "./CanvasNodes";
import { createCanvasGesture } from "./CanvasGesture";
import type { Id } from "@pluribus/backend/dataModel";
import { useCanvasCommands } from "./UseCanvasCommands";
import { useSnapAnimation } from "./UseSnapAnimation";
import type { InteractionEvent } from "@pluribus/core/presence/domain";
import { sourceElement, webPageView } from "./WebPageProjection";
import { documentElement } from "./ElementProjection";
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
  const { workspaceId } = useCanvasScope();
  const flow = useReactFlow();
  const alignment = useRef<AlignmentGesture | null>(null);
  const altPressed = useRef(false);
  const reapplyAlignment = useRef<() => void>(() => {});
  const finishAlignment = useRef<() => void>(() => {});
  const [snapPreviews, setSnapPreviews] = useState<
    { id: string; geometry: Geometry }[]
  >([]);
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
      setSnapPreviews([]);
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
  const cardQuery = useRetainedQuery(api.Canvas.documentCards, { workspaceId });
  const cards = cardQuery.data;
  const sourceQuery = useRetainedQuery(
    api.Sources.cards,
    workspaceId ? { workspaceId } : "skip",
  );
  const sourceRows = sourceQuery.data;
  const imageQuery = useRetainedQuery(
    api.Canvas.imageCards,
    workspaceId ? { workspaceId } : "skip",
  );
  const imageRows = imageQuery.data;
  const [openSourceId, setOpenSourceId] = useState<Id<"sources"> | null>(null);
  const queryFailed =
    cardQuery.failed || sourceQuery.failed || imageQuery.failed;
  const records = useMemo<CanvasElement[] | undefined>(
    () =>
      cards && (!workspaceId || (sourceRows && imageRows))
        ? [
            ...cards
              .map(documentElement)
              .map((r) => ({ ...r, canvasId: workspaceId ?? "shared" })),
            ...(sourceRows ?? []).map(sourceElement),
            ...(imageRows ?? []).map((row) => ({
              id: row.id as string as ImageElementId,
              kind: "image" as const,
              canvasId: String(workspaceId),
              geometry: row.geometry,
              generation: row.generation,
              removed: false,
              name: row.name,
              aiDescription: row.aiDescription,
              url: row.url,
            })),
          ]
        : undefined,
    [cards, sourceRows, imageRows, workspaceId],
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
  const changeSource = useMutation(api.Sources.changeGeometry);
  const changeImage = useMutation(api.Canvas.changeImage);
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
        document: (args) => changeDocument({ ...args, workspaceId }),
        source: (args) =>
          workspaceId
            ? changeSource({ ...args, workspaceId })
            : Promise.resolve(false),
        image: (args) =>
          workspaceId
            ? changeImage({ ...args, workspaceId })
            : Promise.resolve(false),
      }),
    ),
  );
  const state = useStore(
    store,
    useShallow(
      ({
        gestures,
        selected,
        removing,
        editing,
        setEditing,
        historyPending,
      }) => ({
        gestures,
        historyPending,
        selected,
        removing,
        editing,
        setEditing,
      }),
    ),
  );
  const { gestures, selected, removing, setEditing } = state;
  const pending =
    Number(state.historyPending) +
    [...gestures.values()].filter((g) => g.sending || g.queued).length;
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    store.getState().setEnabled(connected);
    if (!connected) {
      geometryGesture.interrupt();
      manipulation.current.clear();
      alignment.current = null;
      setSnapPreviews([]);
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
      setSnapPreviews([]);
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
        record.removed ||
        target.kind !== record.kind ||
        target.generation !== record.generation
      ) {
        if (geometryGesture.has(id)) geometryGesture.interrupt();
        store.getState().cancel(id);
        if (alignment.current?.initial.has(id)) {
          alignment.current = null;
          setSnapPreviews([]);
        }
        geometryTargets.current.delete(id);
      }
    }
  }, [records, store]);

  const {
    addDocument,
    addWebPage,
    addImage,
    deleteSelection,
    history,
    undoElement,
    redoElement,
  } = useCanvasCommands({
    connected,
    records,
    documentCount: cards?.length ?? 0,
    sourceCount: sourceRows?.length ?? 0,
    imageCount: imageRows?.length ?? 0,
    store,
    pendingEditors,
    surface,
  });
  const [geometryGesture] = useState(() => createCanvasGesture(history));
  useEffect(() => () => geometryGesture.dispose(), [geometryGesture]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) geometryGesture.interrupt();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [geometryGesture]);
  const historyState = useStore(history.store);
  const interactionEnabled =
    connected &&
    !historyState.busy &&
    !historyState.retry &&
    !(state.historyPending && !geometryGesture.active);
  const [projectNodes] = useState(createCanvasNodeProjector);
  const reportPending = useCallback((id: ElementId, value: boolean) => {
    pendingEditors.current.set(id, value);
  }, []);
  const arrangeSelection = useCallback(
    (mode: Arrangement) => {
      const current = store.getState();
      if (!interactionEnabled || geometryGesture.busy || current.gestures.size)
        return;
      const items = (recordsRef.current ?? [])
        .filter(
          (r) =>
            current.selected.has(r.id) &&
            !r.removed &&
            !current.removing.has(r.id),
        )
        .map((r) => ({
          id: r.id as string as
            Id<"canvasDocuments"> | Id<"sources"> | Id<"canvasImages">,
          generation: r.generation,
          geometry: r.geometry,
        }));
      if (items.length < 2) return;
      const arranged = arrangeElements(items, mode);
      if (
        arranged.every((item) => {
          const before = items.find((i) => i.id === item.id)!;
          return (
            before.geometry.x === item.geometry.x &&
            before.geometry.y === item.geometry.y
          );
        })
      )
        return;
      if (geometryGesture.start(items)) geometryGesture.stage(arranged, false);
    },
    [store, interactionEnabled, geometryGesture],
  );
  const reportContentHeight = useCallback(
    (id: ElementId, generation: number, height: number) => {
      if (!Number.isFinite(height)) return;
      const record = recordsRef.current?.find((record) => record.id === id);
      if (!record || record.removed || record.generation !== generation) return;
      contentHeights.current.set(id, { generation, height });
      const current = store.getState();
      if (!current.enabled || current.removing.has(id)) return;
      const gesture = current.gestures.get(id);
      const geometry = gesture?.geometry ?? record.geometry;
      if (geometry.height >= height) return;
      if (geometryGesture.has(id)) {
        geometryGesture.stage(
          [
            {
              id: id as string as Id<"canvasDocuments">,
              generation,
              geometry: { ...geometry, height },
            },
          ],
          geometryGesture.active,
        );
        return;
      }
      geometryTargets.current.set(id, geometryTarget(record));
      current.stage(id, { ...geometry, height }, gesture?.active ?? false);
    },
    [store, geometryGesture],
  );
  useEffect(() => {
    if (store.getState().historyPending) return;
    // Width changes may reveal a larger text minimum while the final batch is pending.
    for (const [id, minimum] of contentHeights.current)
      reportContentHeight(id, minimum.generation, minimum.height);
  }, [records, gestures, geometryGesture, reportContentHeight]);
  const sourceViews = useMemo(
    () =>
      new Map(
        (sourceRows ?? []).map((row) => [String(row.id), webPageView(row)]),
      ),
    [sourceRows],
  );
  const nodes = projectNodes(
    records,
    state,
    { interactionEnabled, readPaused: queryFailed },
    {
      pending: reportPending,
      contentHeight: reportContentHeight,
      sources: workspaceId
        ? {
            workspaceId,
            views: sourceViews,
            open: setOpenSourceId,
          }
        : undefined,
    },
  );
  const snapAnimation = useSnapAnimation(surface, nodes, connected);
  const stopEditing = useCallback(() => setEditing(null), [setEditing]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      store
        .getState()
        .select(changes.filter((change) => change.type === "select"));
      if (
        !connected ||
        history.store.getState().busy ||
        history.store.getState().retry
      )
        return;
      if (geometryGesture.busy && !geometryGesture.active) return;
      const moving = changes.filter(
        (change) =>
          (change.type === "position" && change.dragging === true) ||
          (change.type === "dimensions" && change.resizing === true),
      );
      if (!alignment.current && moving.length) {
        // Finish any automatic content-size write before starting a user operation.
        if (store.getState().gestures.size && !geometryGesture.busy) return;
        const movingIds = new Set(
          moving.flatMap((change) => ("id" in change ? [change.id] : [])),
        );
        const current = store.getState();
        const initial = new Map<ElementId, Geometry>();
        const targets = [];
        for (const record of records ?? []) {
          if (current.removing.has(record.id) || record.removed) continue;
          const geometry = {
            ...(current.gestures.get(record.id)?.geometry ?? record.geometry),
          };
          if (movingIds.has(record.id)) initial.set(record.id, geometry);
          else targets.push({ id: record.id, geometry });
        }
        if (initial.size) {
          // Keep one operation for the complete selected group, with captured generations.
          const updates = (records ?? [])
            .filter((r) => initial.has(r.id))
            .map((r) => ({
              id: r.id as string as
                Id<"canvasDocuments"> | Id<"sources"> | Id<"canvasImages">,
              generation: r.generation,
              geometry: initial.get(r.id)!,
            }));
          if (!geometryGesture.start(updates)) return;
          for (const r of records ?? [])
            if (initial.has(r.id))
              geometryTargets.current.set(r.id, geometryTarget(r));
          alignment.current = new AlignmentGesture(
            initial,
            targets,
            moving.some((change) => change.type === "dimensions"),
          );
        }
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
        if (!record || removing.has(record.id) || record.removed) continue;
        const target = geometryTargets.current.get(record.id);
        if (target && target.generation !== record.generation)
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
        if (minimum?.generation === record.generation)
          geometry.height = Math.max(geometry.height, minimum.height);
        updates.set(record.id, { geometry, active });
      }
      if (alignment.current && updates.size) {
        const gesture = alignment.current;
        const first = records?.find((record) => gesture.initial.has(record.id));
        const minimum = first && contentHeights.current.get(first.id);
        const resizing = gesture.resizing;
        const view = flow.getViewport();
        const viewport = {
          x: -view.x / view.zoom,
          y: -view.y / view.zoom,
          width: (surface.current?.clientWidth ?? 0) / view.zoom,
          height: (surface.current?.clientHeight ?? 0) / view.zoom,
        };
        gesture.resolve(
          updates,
          flow.getZoom(),
          altPressed.current,
          {
            minWidth: resizing
              ? first?.kind === "source"
                ? 300
                : first?.kind === "document"
                  ? 300
                  : first?.kind === "image"
                    ? 180
                    : geometryLimits.minSize
              : 0,
            minHeight: resizing
              ? Math.max(
                  first?.kind === "source"
                    ? 132
                    : first?.kind === "image"
                      ? 160
                      : geometryLimits.minSize,
                  first && minimum?.generation === first.generation
                    ? minimum.height
                    : 0,
                )
              : 0,
            maxWidth: resizing ? geometryLimits.maxSize : Infinity,
            maxHeight:
              first?.kind === "source" || first?.kind === "image"
                ? geometryLimits.maxSize
                : Infinity,
            minX: -geometryLimits.maxCoordinate,
            maxX: geometryLimits.maxCoordinate,
            minY: -geometryLimits.maxCoordinate,
            maxY: geometryLimits.maxCoordinate,
          },
          viewport,
        );
        const active = [...updates.values()].some((value) => value.active);
        if (gesture.motion)
          for (const [id, value] of updates)
            snapAnimation.current.set(id, {
              delta: gesture.motion,
              geometry: value.geometry,
            });
        if (!active) {
          for (const { id, geometry } of gesture.releasePreview(
            altPressed.current,
          )) {
            const before =
              updates.get(id)?.geometry ?? gesture.candidates.get(id)!;
            updates.set(id, { geometry, active: false });
            snapAnimation.current.set(id, {
              delta: { x: before.x - geometry.x, y: before.y - geometry.y },
              geometry,
            });
          }
        }
        setSnapPreviews(
          active
            ? gesture.preview(flow.getZoom(), altPressed.current, viewport)
            : [],
        );
        if (!active) alignment.current = null;
      }
      for (const [id, value] of updates) {
        if (value.active)
          manipulation.current.set(
            id,
            changes.some((c) => c.type === "dimensions" && c.id === id)
              ? "resize"
              : "drag",
          );
        else manipulation.current.delete(id);
      }
      if (updates.size && geometryGesture.busy) {
        geometryGesture.stage(
          [...updates].map(([id, value]) => ({
            id: id as string as
              Id<"canvasDocuments"> | Id<"sources"> | Id<"canvasImages">,
            generation: geometryTargets.current.get(id)!.generation,
            geometry: value.geometry,
          })),
          [...updates.values()].some((value) => value.active),
        );
      }
      if (updates.size)
        emit({
          type: "manipulation-changed",
          elements: [...manipulation.current.keys()],
          operation: manipulation.current.values().next().value ?? null,
        });
    },
    [
      store,
      connected,
      records,
      removing,
      emit,
      flow,
      snapAnimation,
      geometryGesture,
      history,
    ],
  );

  useLayoutEffect(() => {
    finishAlignment.current = () => {
      const gesture = alignment.current;
      if (!gesture) return;
      for (const id of gesture.initial.keys()) {
        manipulation.current.delete(id);
      }
      geometryGesture.interrupt();
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
  }, [onNodesChange, store, emit, geometryGesture]);

  return {
    arrangeSelection,
    snapPreviews,
    store,
    queryFailed,
    nodes,
    addDocument,
    addWebPage,
    addImage,
    sourceCount: sourceRows?.length ?? 0,
    imageCount: imageRows?.length ?? 0,
    imageUploadIds: new Set(
      (imageRows ?? []).map((row) => String(row.uploadId)),
    ),
    openSourceId,
    setOpenSourceId,
    interactionEnabled,
    documentCount: cards?.length ?? 0,
    stopEditing,
    onNodesChange,
    deleteSelection,
    history,
    undoElement,
    redoElement,
    connected,
    selected,
    removing,
    pending,
    surface,
  };
}
