import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo } from "react";
import { ViewportPortal, useViewport } from "@xyflow/react";
import type { Geometry } from "@pluribus/core/canvas/domain";
/** Destination silhouettes only; no alignment lines or pointer interception. */
export const SnapPreview = memo(function SnapPreview({
  previews,
}: {
  previews: { id: string; geometry: Geometry }[];
}) {
  const reducedMotion = useReducedMotion();
  const { zoom } = useViewport();
  return (
    <ViewportPortal>
      <AnimatePresence>
        {previews.map(({ id, geometry }) => (
          <motion.div
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.14, ease: "easeOut" }}
            key={id}
            aria-hidden="true"
            className="canvas-snap-preview"
            style={{
              left: geometry.x,
              top: geometry.y,
              width: geometry.width,
              height: geometry.height,
              outlineWidth: 1.5 / zoom,
              outlineOffset: 4 / zoom,
            }}
          />
        ))}
      </AnimatePresence>
    </ViewportPortal>
  );
});
