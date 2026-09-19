import type { Geometry } from "./Geometry";
import type { ElementId } from "./Element";

export type AlignmentAnchor = "start" | "center" | "end";
export type AlignmentTarget = { id: ElementId; geometry: Geometry };
export type AlignmentMatch = {
  axis: "x" | "y";
  sourceAnchor: AlignmentAnchor;
  targetAnchor: AlignmentAnchor;
  targetId: ElementId;
  coordinate: number;
};
export type AlignmentOperation =
  | { kind: "move" }
  | { kind: "resize"; x?: "start" | "end"; y?: "start" | "end" };
export type GeometryConstraints = {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
};
const anchors: AlignmentAnchor[] = ["start", "center", "end"];
export function anchorCoordinate(
  geometry: Geometry,
  axis: "x" | "y",
  anchor: AlignmentAnchor,
) {
  return (
    geometry[axis] +
    (anchor === "start"
      ? 0
      : (axis === "x" ? geometry.width : geometry.height) *
        (anchor === "center" ? 0.5 : 1))
  );
}
export function geometryBounds(geometries: Geometry[]): Geometry {
  const x = Math.min(...geometries.map((g) => g.x)),
    y = Math.min(...geometries.map((g) => g.y));
  return {
    x,
    y,
    width: Math.max(...geometries.map((g) => g.x + g.width)) - x,
    height: Math.max(...geometries.map((g) => g.y + g.height)) - y,
  };
}
/** Inputs and thresholds are canvas units. No browser, viewport, or persistence dependencies. */
export function resolveAlignment(
  candidate: Geometry,
  targets: AlignmentTarget[],
  operation: AlignmentOperation,
  options: {
    acquire: number;
    release: number;
    previous?: AlignmentMatch[];
    constraints?: GeometryConstraints;
  },
): { geometry: Geometry; matches: AlignmentMatch[] } {
  let geometry = { ...candidate };
  const matches: AlignmentMatch[] = [];
  const c = options.constraints ?? {};
  for (const axis of ["x", "y"] as const) {
    const sources =
      operation.kind === "move"
        ? anchors
        : operation[axis]
          ? [operation[axis]!]
          : [];
    const proposals: AlignmentMatch[] = [];
    for (const target of targets)
      for (const sourceAnchor of sources)
        for (const targetAnchor of anchors)
          proposals.push({
            axis,
            sourceAnchor,
            targetAnchor,
            targetId: target.id,
            coordinate: anchorCoordinate(target.geometry, axis, targetAnchor),
          });
    const distance = (m: AlignmentMatch) =>
      Math.abs(
        m.coordinate - anchorCoordinate(candidate, axis, m.sourceAnchor),
      );
    const previous = options.previous?.find((m) => m.axis === axis);
    const held =
      previous &&
      proposals.find(
        (m) =>
          m.sourceAnchor === previous.sourceAnchor &&
          m.targetId === previous.targetId &&
          m.targetAnchor === previous.targetAnchor &&
          distance(m) <= options.release,
      );
    proposals.sort(
      (a, b) =>
        distance(a) - distance(b) ||
        a.targetId.localeCompare(b.targetId) ||
        anchors.indexOf(a.sourceAnchor) - anchors.indexOf(b.sourceAnchor) ||
        anchors.indexOf(a.targetAnchor) - anchors.indexOf(b.targetAnchor),
    );
    for (const match of [
      ...(held ? [held] : []),
      ...proposals.filter((m) => distance(m) <= options.acquire),
    ]) {
      const delta =
        match.coordinate -
        anchorCoordinate(candidate, axis, match.sourceAnchor);
      const next = { ...geometry };
      const size = axis === "x" ? "width" : "height";
      if (operation.kind === "move") next[axis] += delta;
      else if (match.sourceAnchor === "start") {
        next[axis] += delta;
        next[size] -= delta;
      } else next[size] += delta;
      if (
        next.width < (c.minWidth ?? 0) ||
        next.height < (c.minHeight ?? 0) ||
        next.width > (c.maxWidth ?? Infinity) ||
        next.height > (c.maxHeight ?? Infinity) ||
        next.x < (c.minX ?? -Infinity) ||
        next.x > (c.maxX ?? Infinity) ||
        next.y < (c.minY ?? -Infinity) ||
        next.y > (c.maxY ?? Infinity)
      )
        continue;
      geometry = next;
      matches.push(match);
      break;
    }
  }
  return { geometry, matches };
}
