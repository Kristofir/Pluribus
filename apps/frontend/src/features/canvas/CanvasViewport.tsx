import { useEffect, useRef, type RefObject } from "react";
import { useOnViewportChange, useReactFlow } from "@xyflow/react";
import { readViewport, saveViewport } from "./SavedViewport";

/** Restore each canvas's last view without forcing a document-centered frame. */
export function CanvasViewport({
  surface,
  storageKey,
  nodeIds,
  initialLoadComplete,
}: {
  surface: RefObject<HTMLDivElement | null>;
  storageKey: string;
  nodeIds: readonly string[];
  initialLoadComplete: boolean;
}) {
  const restored = useRef<string | null>(null);
  const ready = useRef(false);
  const needsInitialFit = useRef(false);
  useOnViewportChange({
    onEnd: (viewport) => {
      const element = surface.current;
      if (ready.current && element)
        saveViewport(
          storageKey,
          viewport,
          element.clientWidth,
          element.clientHeight,
        );
    },
  });
  const { setViewport, fitView, viewportInitialized } = useReactFlow();
  useEffect(() => {
    if (!viewportInitialized) return;
    const frame = requestAnimationFrame(() => {
      const element = surface.current;
      if (!element?.clientWidth || restored.current === storageKey) return;
      restored.current = storageKey;
      ready.current = false;
      const saved = readViewport(
        storageKey,
        element.clientWidth,
        element.clientHeight,
      );
      if (saved)
        void setViewport(saved).then(() => {
          ready.current = true;
        });
      else {
        ready.current = true;
        if (nodeIds.length)
          void fitView({
            nodes: nodeIds.map((id) => ({ id })),
            padding: 0.15,
            maxZoom: 1,
            duration: 0,
          });
        else needsInitialFit.current = !initialLoadComplete;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    viewportInitialized,
    setViewport,
    fitView,
    surface,
    storageKey,
    nodeIds,
    initialLoadComplete,
  ]);
  useEffect(() => {
    if (initialLoadComplete && !nodeIds.length) needsInitialFit.current = false;
    if (!viewportInitialized || !needsInitialFit.current || !nodeIds.length)
      return;
    const frame = requestAnimationFrame(() => {
      if (!needsInitialFit.current) return;
      needsInitialFit.current = false;
      void fitView({
        nodes: nodeIds.map((id) => ({ id })),
        padding: 0.15,
        maxZoom: 1,
        duration: 0,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, nodeIds, viewportInitialized, initialLoadComplete]);
  return null;
}
