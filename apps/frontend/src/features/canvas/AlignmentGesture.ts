import { targetsInView } from "./SnapViewport";
import {
  geometryBounds,
  resolveAlignment,
  type AlignmentMatch,
  type AlignmentOperation,
  type AlignmentTarget,
  type Geometry,
  type ElementId,
  type GeometryConstraints,
} from "@pluribus/core/canvas/domain";
export type AlignmentGuide = {
  axis: "x" | "y";
  coordinate: number;
  from: number;
  to: number;
  gap?: { from: number; to: number; at: number; size: number };
};
/** A gesture's targets and initial bounds are frozen. Candidates always come from unsnapped input. */
export class AlignmentGesture {
  motion: Partial<Geometry> | null = null;
  private correction: Geometry = { x: 0, y: 0, width: 0, height: 0 };
  readonly candidates: Map<ElementId, Geometry>;
  matches: AlignmentMatch[] = [];
  operation: AlignmentOperation;
  constructor(
    readonly initial: Map<ElementId, Geometry>,
    readonly targets: AlignmentTarget[],
    readonly resizing: boolean,
  ) {
    this.candidates = new Map(initial);
    this.operation = resizing ? { kind: "resize" } : { kind: "move" };
  }
  resolve(
    updates: Map<ElementId, { geometry: Geometry; active: boolean }>,
    zoom: number,
    bypass: boolean,
    constraints: GeometryConstraints = {},
    viewport?: Geometry,
  ) {
    for (const [id, { geometry }] of updates)
      if (this.initial.has(id)) this.candidates.set(id, geometry);
    const raw = geometryBounds([...this.candidates.values()]);
    // Bounds constrain every member's origin, even when the group spans a large area.
    if (!this.resizing) {
      const members = [...this.candidates.values()];
      constraints = {
        ...constraints,
        maxX:
          (constraints.maxX ?? Infinity) -
          Math.max(...members.map((g) => g.x - raw.x)),
        maxY:
          (constraints.maxY ?? Infinity) -
          Math.max(...members.map((g) => g.y - raw.y)),
      };
    }
    if (this.operation.kind === "resize") {
      const start = geometryBounds([...this.initial.values()]);
      if (!this.operation.x && (raw.x !== start.x || raw.width !== start.width))
        this.operation.x = raw.x !== start.x ? "start" : "end";
      if (
        !this.operation.y &&
        (raw.y !== start.y || raw.height !== start.height)
      )
        this.operation.y = raw.y !== start.y ? "start" : "end";
    }
    const result = bypass
      ? { geometry: raw, matches: [] }
      : resolveAlignment(
          raw,
          viewport ? targetsInView(this.targets, viewport, zoom) : this.targets,
          this.operation,
          {
            spacing: 24,
            acquire: 6 / zoom,
            release: 10 / zoom,
            previous: this.matches,
            constraints,
          },
        );
    const correction = {
      x: result.geometry.x - raw.x,
      y: result.geometry.y - raw.y,
      width: result.geometry.width - raw.width,
      height: result.geometry.height - raw.height,
    };
    this.motion = null;
    for (const axis of ["x", "y"] as const) {
      const before = this.matches.find((m) => m.axis === axis);
      const after = result.matches.find((m) => m.axis === axis);
      if (
        before?.targetId === after?.targetId &&
        before?.sourceAnchor === after?.sourceAnchor &&
        before?.targetAnchor === after?.targetAnchor &&
        before?.offset === after?.offset
      )
        continue;
      const size = axis === "x" ? "width" : "height";
      this.motion ??= {};
      this.motion[axis] = this.correction[axis] - correction[axis];
      this.motion[size] = this.correction[size] - correction[size];
    }
    this.correction = correction;
    this.matches = result.matches;
    for (const [id, value] of updates) {
      if (!this.initial.has(id)) continue;
      value.geometry = this.resizing
        ? result.geometry
        : {
            ...value.geometry,
            x: value.geometry.x + result.geometry.x - raw.x,
            y: value.geometry.y + result.geometry.y - raw.y,
          };
    }
    return result.matches.map((match) => {
      const target = this.targets.find((t) => t.id === match.targetId)!;
      const perpendicular = match.axis === "x" ? "y" : "x";
      const size = match.axis === "x" ? "height" : "width";
      return {
        gap: match.offset
          ? {
              from: Math.min(match.coordinate, match.coordinate - match.offset),
              to: Math.max(match.coordinate, match.coordinate - match.offset),
              at:
                (Math.max(
                  result.geometry[perpendicular],
                  target.geometry[perpendicular],
                ) +
                  Math.min(
                    result.geometry[perpendicular] + result.geometry[size],
                    target.geometry[perpendicular] + target.geometry[size],
                  )) /
                2,
              size: Math.abs(match.offset),
            }
          : undefined,
        axis: match.axis,
        coordinate: match.coordinate,
        from: Math.min(
          result.geometry[perpendicular],
          target.geometry[perpendicular],
        ),
        to: Math.max(
          result.geometry[perpendicular] + result.geometry[size],
          target.geometry[perpendicular] + target.geometry[size],
        ),
      };
    });
  }
}
