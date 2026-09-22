import { v } from "convex/values";
export const sourceStatus = v.union(
  v.literal("queued"),
  v.literal("fetching"),
  v.literal("ready"),
  v.literal("failed"),
);
export const sourceTable = v.object({ columns: v.array(v.string()) });
export const screenshot = v.object({
  storageId: v.id("_storage"),
  width: v.number(),
  height: v.number(),
});
export const screenshotView = v.object({
  url: v.union(v.string(), v.null()),
  width: v.number(),
  height: v.number(),
});
export const capture = v.object({
  id: v.string(),
  capturedAt: v.number(),
  url: v.optional(v.string()),
  prompt: v.optional(v.string()),
  table: v.optional(sourceTable),
  title: v.optional(v.string()),
  content: v.string(),
  data: v.optional(v.string()),
  screenshot: v.optional(screenshot),
  screenshotError: v.optional(v.string()),
  extractionFormat: v.optional(v.literal("inferred-v1")),
});

export const defaultSourceGeometry = { x: 80, y: 80, width: 400, height: 360 };

export const captureView = v.object({
  ...capture.fields,
  screenshot: v.optional(screenshotView),
});
