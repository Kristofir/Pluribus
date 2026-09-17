import { type Geometry } from "../domain/Geometry";
import type {
  RectangleElement,
  RectangleColor,
  RectangleId,
} from "../domain/Element";

/**
 * Core-owned storage port for canvas write use cases. Every operation participates
 * in the caller transaction; implementations must not hide external network effects.
 * The port exposes only operations needed by current business behavior.
 */
export interface RectanglePersistence {
  countUpTo(limit: number): Promise<number>;
  get(id: RectangleId): Promise<RectangleElement | null>;
  insert(value: {
    geometry: Geometry;
    color: RectangleColor;
  }): Promise<RectangleId>;
  updateGeometry(id: RectangleId, geometry: Geometry): Promise<void>;
  remove(id: RectangleId): Promise<void>;
}
