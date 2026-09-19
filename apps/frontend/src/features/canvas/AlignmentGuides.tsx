import { memo } from "react";
import { ViewportPortal, useViewport } from "@xyflow/react";
import type { AlignmentGuide } from "./AlignmentGesture";
export const AlignmentGuides = memo(function AlignmentGuides({
  guides,
}: {
  guides: AlignmentGuide[];
}) {
  const { zoom } = useViewport();
  return (
    <ViewportPortal>
      <svg aria-hidden="true" className="canvas-alignment-guides">
        {guides.map((guide) => (
          <line
            key={guide.axis}
            data-alignment-axis={guide.axis}
            x1={guide.axis === "x" ? guide.coordinate : guide.from - 8 / zoom}
            x2={guide.axis === "x" ? guide.coordinate : guide.to + 8 / zoom}
            y1={guide.axis === "y" ? guide.coordinate : guide.from - 8 / zoom}
            y2={guide.axis === "y" ? guide.coordinate : guide.to + 8 / zoom}
            stroke="#d946ef"
            strokeWidth={1 / zoom}
          />
        ))}
      </svg>
    </ViewportPortal>
  );
});
