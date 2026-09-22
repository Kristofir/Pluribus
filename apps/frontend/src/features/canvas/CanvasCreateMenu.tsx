import type { RefObject } from "react";
import { MenuContent, MenuItem } from "@/components/ui/Menu";
export function CanvasCreateMenu({
  point,
  anchor,
  canDocument,
  canWebPage,
  hasWebPages,
  onDocument,
  onWebPage,
  onClose,
}: {
  point: { x: number; y: number };
  anchor: RefObject<HTMLDivElement | null>;
  canDocument: boolean;
  canWebPage: boolean;
  hasWebPages: boolean;
  onDocument: () => void;
  onWebPage: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onKeyDown={(event) => event.stopPropagation()}
      onContextMenuCapture={(event) => event.preventDefault()}
    >
      <MenuContent
        aria-label="Create canvas card"
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
        <MenuItem id="document" isDisabled={!canDocument} onAction={onDocument}>
          Document card
        </MenuItem>
        {hasWebPages && (
          <MenuItem id="web-page" isDisabled={!canWebPage} onAction={onWebPage}>
            Web Page card
          </MenuItem>
        )}
      </MenuContent>
    </div>
  );
}
