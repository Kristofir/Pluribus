import type { Geometry } from "./Geometry";
import type { DocumentId } from "../../documents/domain/Document";

declare const sourceIdBrand: unique symbol;
export type SourceElementId = string & { readonly [sourceIdBrand]: true };
declare const imageIdBrand: unique symbol;
export type ImageElementId = string & { readonly [imageIdBrand]: true };

declare const rectangleIdBrand: unique symbol;
declare const documentElementIdBrand: unique symbol;
export type RectangleId = string & { readonly [rectangleIdBrand]: true };
export type DocumentElementId = string & {
  readonly [documentElementIdBrand]: true;
};
export type ElementId =
  RectangleId | DocumentElementId | SourceElementId | ImageElementId;
/** The prototype currently has one canvas; adding others requires an access policy. */
export type CanvasId = string;
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
export interface SourceElement extends ElementBase {
  id: SourceElementId;
  kind: "source";
}
export interface ImageElement extends ElementBase {
  id: ImageElementId;
  kind: "image";
  name: string;
  url: string | null;
}
/** Narrow by kind before accessing content-specific data; variants are never bags of optional fields. */
export type CanvasElement =
  RectangleElement | DocumentElement | SourceElement | ImageElement;
