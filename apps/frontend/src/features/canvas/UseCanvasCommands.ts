import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMutation } from "convex/react";
import { useReactFlow } from "@xyflow/react";
import type { StoreApi } from "zustand/vanilla";
import { createElementHistory } from "./ElementHistory";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import {
  type CanvasElement,
  type ElementId,
  type RectangleColor,
} from "@pluribus/core/canvas/domain";
import type { CanvasState } from "./CanvasStore";

/** Coordinate user commands and pending-edit guards against the current scene. */
export function useCanvasCommands({
  connected,
  records,
  documentCount,
  store,
  pendingEditors,
  surface,
  color,
}: {
  connected: boolean;
  records: CanvasElement[] | undefined;
  documentCount: number;
  store: StoreApi<CanvasState<ElementId>>;
  pendingEditors: RefObject<Map<ElementId, boolean>>;
  surface: RefObject<HTMLDivElement | null>;
  color: RectangleColor;
}) {
  const open = useMutation(api.Canvas.openHistorySession);
  const apply = useMutation(api.Canvas.applyHistoryAction);
  const reverse = useMutation(api.Canvas.reverseHistoryAction);
  const update = useMutation(api.Canvas.updateHistoryGesture);
  const close = useMutation(api.Canvas.closeHistoryGesture);
  const heartbeat = useMutation(api.Canvas.heartbeatHistoryGesture);
  const [history] = useState(() =>
    createElementHistory(
      {
        open,
        apply,
        reverse,
        update,
        close,
        heartbeat,
        token: () => crypto.randomUUID(),
      },
      {
        guardRemoval: (ids) =>
          ids.some((id) => pendingEditors.current.get(id as ElementId))
            ? "Wait for document edits to save before removal."
            : null,
        preview: (updates, active) => {
          for (const u of updates)
            store
              .getState()
              .preview(u.id as string as ElementId, u.geometry, active);
        },
        clear: (ids) => {
          for (const id of ids) store.getState().cancel(id as ElementId);
        },
        pending: (historyPending) => store.setState({ historyPending }),
      },
    ),
  );
  useEffect(() => {
    history.mount();
    return () => history.dispose();
  }, [history]);
  const flow = useReactFlow();
  // Commands read the latest committed scene without changing identity on movement.
  const recordsRef = useRef(records);
  useLayoutEffect(() => {
    recordsRef.current = records;
  }, [records]);
  const elementCount = records?.length ?? 0;
  const addRectangle = useCallback(async () => {
    if (
      !connected ||
      !surface.current ||
      store.getState().historyPending ||
      store.getState().gestures.size ||
      history.store.getState().busy ||
      history.store.getState().retry ||
      !store.getState().beginCreate()
    )
      return;
    const bounds = surface.current.getBoundingClientRect();
    const offset = (elementCount % 5) * 24;
    const center = flow.screenToFlowPosition({
      x: bounds.left + bounds.width / 2 + offset,
      y: bounds.top + bounds.height / 2 + offset,
    });
    try {
      const accepted = await history.perform({
        kind: "create",
        element: {
          kind: "rectangle",
          geometry: {
            x: center.x - 80,
            y: center.y - 50,
            width: 160,
            height: 100,
          },
          color: color,
        },
      });
      const entry = history.store.getState().undo.at(-1);
      if (accepted && entry?.kind === "create" && entry.id)
        store.getState().selectOnly(entry.id as string as ElementId);
      store.getState().finishCreate();
    } catch {
      store.getState().finishCreate("Could not add a rectangle.");
    }
  }, [connected, surface, store, elementCount, flow, history, color]);

  const addDocument = useCallback(async () => {
    if (
      !connected ||
      store.getState().historyPending ||
      store.getState().gestures.size ||
      history.store.getState().busy ||
      history.store.getState().retry ||
      !store.getState().beginCreate()
    )
      return;
    try {
      const accepted = await history.perform({
        kind: "create",
        element: {
          kind: "document",
          geometry: {
            x: 80 + documentCount * 460,
            y: 80,
            width: 430,
            height: 500,
          },
        },
      });
      const entry = history.store.getState().undo.at(-1);
      if (accepted && entry?.kind === "create" && entry.id)
        store.getState().selectOnly(entry.id as string as ElementId);
      store.getState().finishCreate();
    } catch {
      store
        .getState()
        .finishCreate(
          "Could not add document. This canvas holds at most two active documents.",
        );
    }
  }, [connected, store, history, documentCount]);
  const deleteSelection = useCallback(async () => {
    const records = recordsRef.current;
    const { selected, removing, setEditing } = store.getState();
    if (
      !connected ||
      store.getState().historyPending ||
      store.getState().gestures.size > 0 ||
      history.store.getState().busy ||
      history.store.getState().retry
    )
      return;
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
    surface.current?.closest("main")?.focus({ preventScroll: true });
    let failed = false;
    for (const id of ids) {
      const record = records?.find((r) => r.id === id);
      try {
        if (
          record &&
          !(await history.perform({
            kind: "delete",
            id: record.id as string as Id<"canvasDocuments"> | Id<"rectangles">,
            generation: record.generation,
          }))
        ) {
          failed = true;
          break;
        }
      } catch {
        failed = true;
        break;
      }
    }
    store
      .getState()
      .finishRemove(
        ids,
        failed
          ? "Some elements could not be deleted. Check History or retry."
          : undefined,
      );
  }, [connected, store, pendingEditors, history, surface]);

  const undoElement = useCallback(async () => {
    if (
      !connected ||
      store.getState().historyPending ||
      store.getState().gestures.size
    )
      return;
    const entry = history.store.getState().undo.at(-1);
    if (entry?.kind !== "create" || !entry.id) {
      await history.undo();
      return;
    }
    const id = entry.id as string as ElementId;
    if (pendingEditors.current.get(id)) {
      store
        .getState()
        .finishCreate("Wait for document edits to save before Undo.");
      return;
    }
    store.getState().setEditing(null);
    store.getState().beginRemove([id]);
    surface.current?.closest("main")?.focus({ preventScroll: true });
    await history.undo();
    store.getState().finishRemove([id]);
  }, [connected, history, store, pendingEditors, surface]);
  const redoElement = useCallback(async () => {
    const entry = history.store.getState().redo.at(-1);
    if (
      !connected ||
      !entry ||
      store.getState().historyPending ||
      store.getState().gestures.size
    )
      return;
    if (entry.kind !== "delete") {
      surface.current?.closest("main")?.focus({ preventScroll: true });
      await history.redo();
      return;
    }
    const id = entry.id as string as ElementId;
    if (pendingEditors.current.get(id)) {
      store
        .getState()
        .finishCreate("Wait for document edits to save before Redo.");
      return;
    }
    store.getState().setEditing(null);
    store.getState().beginRemove([id]);
    surface.current?.closest("main")?.focus({ preventScroll: true });
    await history.redo();
    store.getState().finishRemove([id]);
  }, [connected, history, pendingEditors, store, surface]);
  return {
    addRectangle,
    addDocument,
    deleteSelection,
    history,
    undoElement,
    redoElement,
  };
}
