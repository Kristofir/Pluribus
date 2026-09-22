import { memo, useCallback, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { Id } from "@pluribus/backend/dataModel";
import { geometryLimits } from "@pluribus/core/canvas/domain";
import { WebPageCard } from "../sources/WebPageCard";
import type { WebPageView } from "../sources/WebPageView";
export type WebPageNode = Node<
  {
    source: WebPageView;
    workspaceId: Id<"workspaces">;
    editable: boolean;
    included: boolean;
    include: (value: boolean) => void;
    open: () => void;
    contentHeight: (height: number) => void;
  },
  "source"
>;
/** React Flow owns gestures; the source feature owns captured content and controls. */
export const WebPageNodeCard = memo(function WebPageNodeCard({
  data,
  selected,
}: NodeProps<WebPageNode>) {
  const [resizing, setResizing] = useState(false);
  const [minimumHeight, setMinimumHeight] = useState(132);
  const measure = useCallback(
    (height: number) => {
      const minimum = Math.max(132, height);
      setMinimumHeight(minimum);
      data.contentHeight(minimum);
    },
    [data.contentHeight],
  );
  return (
    <div className="web-page-node-content" data-resizing={resizing}>
      <NodeResizer
        onResizeStart={() => setResizing(true)}
        onResizeEnd={() => setResizing(false)}
        isVisible={!!selected && data.editable}
        minWidth={300}
        minHeight={minimumHeight}
        maxWidth={geometryLimits.maxSize}
        maxHeight={geometryLimits.maxSize}
      />
      <WebPageCard
        source={data.source}
        onOpen={data.open}
        onContentHeight={measure}
      />
    </div>
  );
});
