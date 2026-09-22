import { SelectionMode } from "@xyflow/react";
/** Shared interaction configuration: primary drag selects, Space/middle drag pans. */
export const canvasSelection = {
  selectionOnDrag: true,
  selectionKeyCode: null,
  selectionMode: SelectionMode.Partial,
  multiSelectionKeyCode: "Shift",
  panActivationKeyCode: "Space",
  panOnDrag: [1],
};
