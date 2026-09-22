import { expect, test } from "vitest";
import {
  besideMainPaper,
  mainPaperNode,
  mainPaperWidth,
} from "./MainPaperNode";

test("main paper is fixed and excluded from selectable/deletable elements", () => {
  const node = mainPaperNode(null);
  expect(node.position).toEqual({ x: -mainPaperWidth / 2, y: 0 });
  expect(node).toMatchObject({
    draggable: false,
    selectable: false,
    deletable: false,
    connectable: false,
    focusable: false,
  });
  // Let React Flow measure natural content height; no fixed height or resize control.
  expect(node.height).toBeUndefined();
});
test("new overlapping cards go beside paper, existing outside positions stay intact", () => {
  expect(besideMainPaper({ x: 80, y: 80 }, 430)).toEqual({ x: 480, y: 80 });
  expect(besideMainPaper({ x: -350, y: 20 }, 400)).toEqual({ x: -880, y: 20 });
  expect(besideMainPaper({ x: 600, y: 20 }, 400)).toEqual({ x: 600, y: 20 });
  expect(besideMainPaper({ x: -1000, y: 20 }, 400)).toEqual({
    x: -1000,
    y: 20,
  });
});
