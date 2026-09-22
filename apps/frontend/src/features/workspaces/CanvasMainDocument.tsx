import { useCallback, type ComponentProps } from "react";
import { useReactFlow } from "@xyflow/react";
import { DocumentPanelSession } from "./DocumentPanelSession";
/** The canonical session lives here once, inside React Flow, never in a second panel. */
export function CanvasMainDocument(
  props: ComponentProps<typeof DocumentPanelSession>,
) {
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();
  const revealTarget = useCallback(
    (target: HTMLElement) => {
      const bounds = target.getBoundingClientRect();
      const point = screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + Math.min(bounds.height / 2, 80),
      });
      void setCenter(point.x, point.y, { zoom: getZoom() });
    },
    [screenToFlowPosition, setCenter, getZoom],
  );
  return (
    <DocumentPanelSession
      {...props}
      presentation="canvas"
      onRevealTarget={revealTarget}
    />
  );
}
