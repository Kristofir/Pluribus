import { memo, useEffect, type ReactNode, type RefObject } from "react";
import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";

export const mainPaperId = "workspace-main-paper";
export const mainPaperWidth = 800;
export type MainPaperNode = Node<{ content: ReactNode }, "mainPaper">;

/** Presentation only: this node never enters the durable element/History model. */
export function mainPaperNode(content: ReactNode): MainPaperNode {
  return {
    id: mainPaperId,
    type: "mainPaper",
    position: { x: -mainPaperWidth / 2, y: 0 },
    width: mainPaperWidth,
    draggable: false,
    selectable: false,
    deletable: false,
    connectable: false,
    focusable: false,
    // Keep writing legible over legacy overlaps; selected cards use React Flow elevation.
    zIndex: 1,
    data: { content },
  };
}
export const MainPaper = memo(function MainPaper({
  data,
}: NodeProps<MainPaperNode>) {
  return (
    <div
      className="canvas-main-paper nodrag"
      onKeyDown={(event) => event.stopPropagation()}
    >
      {data.content}
    </div>
  );
});

/** Frame the top at a width-based zoom; document length must never shrink the text. */
export function MainPaperViewport({
  request,
  surface,
}: {
  request: number;
  surface: RefObject<HTMLDivElement | null>;
}) {
  const { setViewport, viewportInitialized } = useReactFlow();
  useEffect(() => {
    if (!viewportInitialized) return;
    const frame = requestAnimationFrame(() => {
      const width = surface.current?.clientWidth ?? 0;
      if (!width) return;
      void setViewport({
        x: width / 2,
        y: 32,
        zoom: Math.max(0.1, Math.min(1, (width - 64) / mainPaperWidth)),
      });
      if (request > 0)
        surface.current
          ?.querySelector<HTMLElement>(".canvas-main-paper h2")
          ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [request, viewportInitialized, setViewport, surface]);
  return null;
}

/** Keep new cards beside the paper without relocating any existing element. */
export function besideMainPaper(
  position: { x: number; y: number },
  width: number,
) {
  const left = -mainPaperWidth / 2,
    right = mainPaperWidth / 2;
  if (position.x + width <= left - 48 || position.x >= right + 48)
    return position;
  return {
    ...position,
    x: position.x + width / 2 < 0 ? left - 80 - width : right + 80,
  };
}
