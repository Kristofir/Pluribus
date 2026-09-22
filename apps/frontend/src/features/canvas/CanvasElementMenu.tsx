import type { RefObject } from "react";
import { MenuContent, MenuItem, MenuSubMenu } from "@/components/ui/Menu";
import type { Arrangement } from "./ArrangeElements";
export function CanvasElementMenu({
  point,
  anchor,
  count,
  disabled,
  onDelete,
  onArrange,
  onClose,
}: {
  point: { x: number; y: number };
  anchor: RefObject<HTMLDivElement | null>;
  count: number;
  disabled: boolean;
  onDelete: () => void;
  onArrange: (mode: Arrangement) => void;
  onClose: () => void;
}) {
  return (
    <div
      onKeyDown={(event) => event.stopPropagation()}
      onContextMenuCapture={(event) => event.preventDefault()}
    >
      <MenuContent
        aria-label="Selected elements"
        autoFocus="first"
        popover={{
          isOpen: true,
          onOpenChange: (open) => {
            if (!open) onClose();
          },
          triggerRef: anchor,
          getTargetRect: () => new DOMRect(point.x, point.y, 0, 0),
          placement: "bottom start",
          offset: 2,
        }}
      >
        <MenuItem id="delete" isDisabled={disabled} onAction={onDelete}>
          {count > 1 ? "Delete All" : "Delete"}
        </MenuItem>
        {count > 1 && (
          <MenuSubMenu>
            <MenuItem id="arrange" isDisabled={disabled}>
              Arrange
            </MenuItem>
            <MenuContent aria-label="Arrange elements">
              <MenuItem id="grid" onAction={() => onArrange("grid")}>
                Grid
              </MenuItem>
              <MenuItem id="masonry" onAction={() => onArrange("masonry")}>
                Masonry
              </MenuItem>
              <MenuItem
                id="horizontal"
                onAction={() => onArrange("horizontal")}
              >
                Horizontally
              </MenuItem>
              <MenuItem id="vertical" onAction={() => onArrange("vertical")}>
                Vertically
              </MenuItem>
            </MenuContent>
          </MenuSubMenu>
        )}
      </MenuContent>
    </div>
  );
}
