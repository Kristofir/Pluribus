import type { FunctionReturnType } from "convex/server";
import type { api } from "@pluribus/backend/api";
import type {
  SourceElement,
  SourceElementId,
} from "@pluribus/core/canvas/domain";
import type { WebPageView } from "../sources/WebPageView";
export type WebPageRow = FunctionReturnType<typeof api.Sources.cards>[number];
export function sourceElement(row: WebPageRow): SourceElement {
  return {
    id: row.id as string as SourceElementId,
    kind: "source",
    canvasId: row.canvasId,
    geometry: row.geometry,
    generation: row.generation,
    removed: false,
  };
}
export function webPageView(row: WebPageRow): WebPageView {
  return {
    id: row.id,
    url: row.url,
    prompt: row.prompt,
    table: row.table,
    status: row.status,
    revision: row.revision,
    deadlineAt: row.deadlineAt,
    capture: row.capture
      ? {
          url: row.capture.url,
          prompt: row.capture.prompt,
          table: row.capture.table,
          extractionFormat: row.capture.extractionFormat,
          screenshot: row.capture.screenshot,
          screenshotError: row.capture.screenshotError,
          capturedAt: row.capture.capturedAt,
        }
      : undefined,
    error: row.error,
    title: row.capture?.title,
    preview: row.capture?.preview,
    hasCapture: !!row.capture,
    capturedAt: row.capture?.capturedAt,
  };
}
