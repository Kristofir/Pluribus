import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import {
  geometryLimits,
  type RectangleColor,
} from "@pluribus/core/canvas/domain";
export type RectangleNode = Node<
  { color: RectangleColor; editable: boolean },
  "rectangle"
>;
export const Rectangle = memo(function Rectangle({
  selected,
  data,
}: NodeProps<RectangleNode>) {
  return (
    <div className={`canvas-rectangle canvas-${data.color}`}>
      <NodeResizer
        isVisible={selected && data.editable}
        minWidth={geometryLimits.minSize}
        minHeight={geometryLimits.minSize}
        maxWidth={geometryLimits.maxSize}
        maxHeight={geometryLimits.maxSize}
      />
    </div>
  );
});
