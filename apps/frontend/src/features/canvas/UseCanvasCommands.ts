import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMutation } from "convex/react";
import { useReactFlow } from "@xyflow/react";
import type { StoreApi } from "zustand/vanilla";
import { createDocumentHistory } from "./DocumentHistory";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import {
  rectangleLimits,
  type CanvasElement,
  type ElementId,
  type RectangleId,
  type DocumentElementId,
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
  const create = useMutation(api.Canvas.create);
  const createDocument = useMutation(api.Canvas.createDocument);
  const deleteDocument = useMutation(api.Canvas.deleteDocument);
  const undoDeletion = useMutation(api.Canvas.undoDeletion);
  const [history] = useState(() =>
    createDocumentHistory({
      remove: deleteDocument,
      restore: undoDeletion,
      token: () => crypto.randomUUID(),
    }),
  );
  const remove = useMutation(api.Canvas.remove);
  const flow = useReactFlow();
  // Commands read the latest committed scene without changing identity on movement.
  const recordsRef = useRef(records);
  useLayoutEffect(() => {
    recordsRef.current = records;
  }, [records]);
  const elementCount = records?.length ?? 0;
  const addRectangle = useCallback(async () => {
    if (!connected || !surface.current || !store.getState().beginCreate())
      return;
    const bounds = surface.current.getBoundingClientRect();
    const offset = (elementCount % 5) * 24;
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
        color: color,
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
  }, [connected, surface, store, elementCount, flow, create, color]);

  const addDocument = useCallback(async () => {
    if (!connected || !store.getState().beginCreate()) return;
    try {
      const id = await createDocument({
        geometry: {
          x: 80 + documentCount * 460,
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
          "Could not add document. This canvas holds at most two active documents.",
        );
    }
  }, [connected, store, createDocument, documentCount]);
  const deleteSelection = useCallback(async () => {
    const records = recordsRef.current;
    const { selected, removing, setEditing } = store.getState();
    if (
      !connected ||
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
        if (record?.kind === "document") {
          if (
            !(await history.remove(
              record.id as string as Id<"canvasDocuments">,
              record.generation,
            ))
          ) {
            failed = true;
            break;
          }
        } else await remove({ id: id as string as Id<"rectangles"> });
      } catch {
        failed = true;
      }
    }
    store
      .getState()
      .finishRemove(
        ids,
        failed
          ? "Some elements could not be deleted. Check document history or retry."
          : undefined,
      );
  }, [connected, store, pendingEditors, history, remove, surface]);

  const undoDocument = useCallback(async () => {
    if (connected) await history.undo();
  }, [connected, history]);
  const redoDocument = useCallback(async () => {
    const entry = history.store.getState().redo.at(-1);
    if (!connected || !entry) return;
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
    undoDocument,
    redoDocument,
  };
}
