import type { AlignmentTarget, Geometry } from "@pluribus/core/canvas/domain";
/** Screen-space padding keeps just-offscreen neighbors available at every zoom. */
export function targetsInView(
  targets: readonly AlignmentTarget[],
  viewport: Geometry,
  zoom: number,
) {
  const margin = 160 / zoom;
  return targets.filter(
    ({ geometry: g }) =>
      g.x + g.width >= viewport.x - margin &&
      g.x <= viewport.x + viewport.width + margin &&
      g.y + g.height >= viewport.y - margin &&
      g.y <= viewport.y + viewport.height + margin,
  );
}
