import { besideMainPaper } from "./MainPaperNode";
import { sourceLimits } from "@pluribus/core/sources/domain";
import { useReactFlow } from "@xyflow/react";
import { documentLimits } from "@pluribus/core/canvas/domain";
import { useCanvasScope } from "./CanvasScope";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMutation } from "convex/react";
import type { StoreApi } from "zustand/vanilla";
import { createElementHistory } from "./ElementHistory";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import {
  type CanvasElement,
  type ElementId,
} from "@pluribus/core/canvas/domain";
import type { CanvasState } from "./CanvasStore";

/** Coordinate user commands and pending-edit guards against the current scene. */
export function useCanvasCommands({
  connected,
  records,
  documentCount,
  sourceCount,
  store,
  pendingEditors,
  surface,
}: {
  connected: boolean;
  records: CanvasElement[] | undefined;
  documentCount: number;
  sourceCount: number;
  store: StoreApi<CanvasState<ElementId>>;
  pendingEditors: RefObject<Map<ElementId, boolean>>;
  surface: RefObject<HTMLDivElement | null>;
}) {
  const { workspaceId, mainPaper } = useCanvasScope();
  const hasMainPaper = !!mainPaper;
  const flow = useReactFlow();
  const open = useMutation(api.Canvas.openHistorySession);
  const apply = useMutation(api.Canvas.applyHistoryAction);
  const reverse = useMutation(api.Canvas.reverseHistoryAction);
  const update = useMutation(api.Canvas.updateHistoryGesture);
  const close = useMutation(api.Canvas.closeHistoryGesture);
  const heartbeat = useMutation(api.Canvas.heartbeatHistoryGesture);
  const [history] = useState(() =>
    createElementHistory(
      {
        open: (args) => open({ ...args, workspaceId }),
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
  // Commands read the latest committed scene without changing identity on movement.
  const recordsRef = useRef(records);
  useLayoutEffect(() => {
    recordsRef.current = records;
  }, [records]);
  const addDocument = useCallback(
    async (position?: { x: number; y: number }) => {
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
              ...(position ??
                (hasMainPaper
                  ? besideMainPaper({ x: 80 + documentCount * 460, y: 80 }, 430)
                  : { x: 80 + documentCount * 460, y: 80 })),
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
            `Could not add document. This canvas holds at most ${documentLimits.maxCount} active documents.`,
          );
      }
    },
    [connected, store, history, documentCount, hasMainPaper],
  );
  const addWebPage = useCallback(
    async (
      input: { url: string; prompt?: string },
      position?: { x: number; y: number },
    ) => {
      if (
        !workspaceId ||
        sourceCount >= sourceLimits.maxCount ||
        !connected ||
        store.getState().historyPending ||
        store.getState().gestures.size ||
        history.store.getState().busy ||
        history.store.getState().retry ||
        !store.getState().beginCreate()
      )
        throw new Error("Canvas is busy or unavailable");
      try {
        const bounds = surface.current?.getBoundingClientRect();
        const center = bounds
          ? flow.screenToFlowPosition({
              x: bounds.left + bounds.width / 2,
              y: bounds.top + bounds.height / 2,
            })
          : { x: 280, y: 260 };
        const accepted = await history.perform({
          kind: "create",
          element: {
            kind: "source",
            ...input,
            geometry: {
              ...(position ??
                (hasMainPaper
                  ? besideMainPaper(
                      { x: center.x - 150, y: center.y - 88 },
                      300,
                    )
                  : { x: center.x - 150, y: center.y - 88 })),
              width: 300,
              height: 176,
            },
          },
        });
        if (!accepted)
          throw new Error("Web Page was not accepted; check History");
        const entry = history.store.getState().undo.at(-1);
        if (entry?.kind === "create" && entry.id)
          store.getState().selectOnly(entry.id as string as ElementId);
        return entry?.kind === "create" ? entry.id : undefined;
      } finally {
        store.getState().finishCreate();
      }
    },
    [
      workspaceId,
      connected,
      store,
      history,
      flow,
      surface,
      sourceCount,
      hasMainPaper,
    ],
  );
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
            id: record.id as string as Id<"canvasDocuments"> | Id<"sources">,
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
    addDocument,
    addWebPage,
    deleteSelection,
    history,
    undoElement,
    redoElement,
  };
}
