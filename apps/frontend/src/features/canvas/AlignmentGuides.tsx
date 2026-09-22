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
          <g key={guide.axis}>
            <line
              data-alignment-axis={guide.axis}
              x1={guide.axis === "x" ? guide.coordinate : guide.from - 8 / zoom}
              x2={guide.axis === "x" ? guide.coordinate : guide.to + 8 / zoom}
              y1={guide.axis === "y" ? guide.coordinate : guide.from - 8 / zoom}
              y2={guide.axis === "y" ? guide.coordinate : guide.to + 8 / zoom}
              stroke="var(--alignment-guide)"
              strokeWidth={1 / zoom}
            />
            {guide.gap && (
              <>
                <line
                  x1={guide.axis === "x" ? guide.gap.from : guide.gap.at}
                  x2={guide.axis === "x" ? guide.gap.to : guide.gap.at}
                  y1={guide.axis === "y" ? guide.gap.from : guide.gap.at}
                  y2={guide.axis === "y" ? guide.gap.to : guide.gap.at}
                  stroke="var(--alignment-guide)"
                  strokeWidth={2 / zoom}
                />
                <text
                  x={
                    guide.axis === "x"
                      ? (guide.gap.from + guide.gap.to) / 2
                      : guide.gap.at + 8 / zoom
                  }
                  y={
                    guide.axis === "y"
                      ? (guide.gap.from + guide.gap.to) / 2
                      : guide.gap.at - 8 / zoom
                  }
                  textAnchor={guide.axis === "x" ? "middle" : "start"}
                  fill="var(--alignment-guide)"
                  fontSize={12 / zoom}
                >
                  {guide.gap.size}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </ViewportPortal>
  );
});
