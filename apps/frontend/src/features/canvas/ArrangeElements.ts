import { geometryLimits, type Geometry } from "@pluribus/core/canvas/domain";
export type Arrangement = "grid" | "masonry" | "horizontal" | "vertical";
/** Stable reading order; preserve sizes and use the existing 24px canvas spacing. */
export function arrangeElements<T extends { id: string; geometry: Geometry }>(
  items: T[],
  mode: Arrangement,
): T[] {
  if (!items.length) return [];
  const sorted = [...items].sort(
    (a, b) =>
      a.geometry.y - b.geometry.y ||
      a.geometry.x - b.geometry.x ||
      a.id.localeCompare(b.id),
  );
  const columns =
    mode === "vertical"
      ? 1
      : mode === "horizontal"
        ? sorted.length
        : Math.ceil(Math.sqrt(sorted.length));
  const heights = Array<number>(columns).fill(0);
  const assignments = sorted.map((item, index) => {
    const column =
      mode === "masonry"
        ? heights.indexOf(Math.min(...heights))
        : index % columns;
    heights[column] += item.geometry.height + 24;
    return column;
  });
  const widths = Array.from({ length: columns }, (_, column) =>
    Math.max(
      ...sorted
        .filter((_, index) => assignments[index] === column)
        .map((item) => item.geometry.width),
    ),
  );
  const origin = {
    x: Math.min(...items.map((i) => i.geometry.x)),
    y: Math.min(...items.map((i) => i.geometry.y)),
  };
  let y = origin.y;
  const result: T[] = [];
  if (mode === "masonry") {
    heights.fill(origin.y);
    sorted.forEach((item, index) => {
      const column = assignments[index];
      const x =
        origin.x +
        widths.slice(0, column).reduce((sum, width) => sum + width + 24, 0);
      result.push({
        ...item,
        geometry: { ...item.geometry, x, y: heights[column] },
      });
      heights[column] += item.geometry.height + 24;
    });
  } else {
    for (let row = 0; row < sorted.length; row += columns) {
      let x = origin.x;
      const members = sorted.slice(row, row + columns);
      members.forEach((item, column) => {
        result.push({ ...item, geometry: { ...item.geometry, x, y } });
        x += widths[column] + 24;
      });
      y += Math.max(...members.map((i) => i.geometry.height)) + 24;
    }
  }
  const dx = Math.max(
    0,
    Math.max(...result.map((i) => i.geometry.x)) - geometryLimits.maxCoordinate,
  );
  const dy = Math.max(
    0,
    Math.max(...result.map((i) => i.geometry.y)) - geometryLimits.maxCoordinate,
  );
  return result.map((item) => ({
    ...item,
    geometry: {
      ...item.geometry,
      x: item.geometry.x - dx,
      y: item.geometry.y - dy,
    },
  }));
}
