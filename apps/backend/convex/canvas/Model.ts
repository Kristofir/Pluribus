import { v } from "convex/values";
export const geometry = v.object({
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
});
export const color = v.union(
  v.literal("blue"),
  v.literal("coral"),
  v.literal("gold"),
);
export const rectangle = geometry.extend({ color });
export const rectangleView = rectangle.extend({
  id: v.id("rectangles"),
  generation: v.number(),
});
