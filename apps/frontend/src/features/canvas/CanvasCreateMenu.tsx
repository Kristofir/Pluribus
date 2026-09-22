import type { RefObject } from "react";
import { MenuContent, MenuItem } from "@/components/ui/Menu";
export function CanvasCreateMenu({
  point,
  anchor,
  canDocument,
  canWebPage,
  canImage,
  hasWebPages,
  onDocument,
  onWebPage,
  onImage,
  onImportUrl,
  onClose,
}: {
  point: { x: number; y: number };
  anchor: RefObject<HTMLDivElement | null>;
  canDocument: boolean;
  canWebPage: boolean;
  canImage: boolean;
  hasWebPages: boolean;
  onDocument: () => void;
  onWebPage: () => void;
  onImage: () => void;
  onImportUrl: () => void;
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
          <MenuItem id="image" isDisabled={!canImage} onAction={onImage}>
            Image card…
          </MenuItem>
        )}
        {hasWebPages && (
          <MenuItem
            id="import-url"
            isDisabled={!canWebPage && !canImage}
            onAction={onImportUrl}
          >
            Import URL…
          </MenuItem>
        )}
        {hasWebPages && (
          <MenuItem id="web-page" isDisabled={!canWebPage} onAction={onWebPage}>
            Web Page card
          </MenuItem>
        )}
      </MenuContent>
    </div>
  );
}
