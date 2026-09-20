import type { Geometry } from "./Geometry";
import type { DocumentId } from "../../documents/domain/Document";

declare const rectangleIdBrand: unique symbol;
declare const documentElementIdBrand: unique symbol;
export type RectangleId = string & { readonly [rectangleIdBrand]: true };
export type DocumentElementId = string & {
  readonly [documentElementIdBrand]: true;
};
export type ElementId = RectangleId | DocumentElementId;
/** The prototype currently has one canvas; adding others requires an access policy. */
export type CanvasId = "shared";
export const rectangleColors = ["blue", "coral", "gold"] as const;
export type RectangleColor = (typeof rectangleColors)[number];

/** Shared spatial identity and lifecycle. Variants own their content fields. */
export interface ElementBase {
  id: ElementId;
  canvasId: CanvasId;
  geometry: Geometry;
  generation: number;
  removed: boolean;
}
export interface RectangleElement extends ElementBase {
  id: RectangleId;
  kind: "rectangle";
  color: RectangleColor;
}
export interface DocumentElement extends ElementBase {
  id: DocumentElementId;
  kind: "document";
  /** Internal text identity; the document element remains the user-managed object. */
  documentId: DocumentId;
}
/** Narrow by kind before accessing content-specific data; variants are never bags of optional fields. */
export type CanvasElement = RectangleElement | DocumentElement;
