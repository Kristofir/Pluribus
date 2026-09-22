import { expect, test } from "vitest";
import { arrangeElements } from "./ArrangeElements";
const items = [
  { id: "b", geometry: { x: 400, y: 200, width: 200, height: 80 } },
  { id: "a", geometry: { x: 100, y: 100, width: 300, height: 120 } },
  { id: "c", geometry: { x: 600, y: 300, width: 150, height: 200 } },
];
test("horizontal and vertical arrangements preserve sizes and consistent gaps", () => {
  const horizontal = arrangeElements(items, "horizontal");
  expect(horizontal.map((i) => [i.id, i.geometry.x, i.geometry.y])).toEqual([
    ["a", 100, 100],
    ["b", 424, 100],
    ["c", 648, 100],
  ]);
  const vertical = arrangeElements(items, "vertical");
  expect(vertical.map((i) => [i.geometry.x, i.geometry.y])).toEqual([
    [100, 100],
    [100, 244],
    [100, 348],
  ]);
  for (const item of horizontal)
    expect([item.geometry.width, item.geometry.height]).toEqual([
      items.find((i) => i.id === item.id)!.geometry.width,
      items.find((i) => i.id === item.id)!.geometry.height,
    ]);
  expect(items[0].geometry.x).toBe(400);
});
test("grid accommodates variable card sizes without overlap", () => {
  expect(
    arrangeElements(items, "grid").map((i) => [i.geometry.x, i.geometry.y]),
  ).toEqual([
    [100, 100],
    [424, 100],
    [100, 244],
  ]);
});
test("arrangement keeps origins within canvas limits", () => {
  const result = arrangeElements(
    items.map((i) => ({
      ...i,
      geometry: { ...i.geometry, x: 99990, y: 99990 },
    })),
    "horizontal",
  );
  expect(Math.max(...result.map((i) => i.geometry.x))).toBe(100000);
});

test("masonry fills the shortest column and sizes columns for their widest assigned card", () => {
  const input = [
    ...items,
    { id: "d", geometry: { x: 700, y: 400, width: 450, height: 60 } },
  ];
  const result = arrangeElements(input, "masonry");
  expect(result.map((i) => [i.id, i.geometry.x, i.geometry.y])).toEqual([
    ["a", 100, 100],
    ["b", 574, 100],
    ["c", 574, 204],
    ["d", 100, 244],
  ]);
  expect(result.map((i) => [i.geometry.width, i.geometry.height])).toEqual([
    [300, 120],
    [200, 80],
    [150, 200],
    [450, 60],
  ]);
  expect(arrangeElements(input, "masonry")).toEqual(result);
});
