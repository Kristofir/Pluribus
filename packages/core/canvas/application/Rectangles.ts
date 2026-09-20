import { assertElementGeometry, type Geometry } from "../domain/Geometry";
import { assertCanvasAccess, type CanvasActor } from "../domain/Access";
import { CanvasCapacityReached, rectangleLimits } from "../domain/Rectangle";
import type { RectangleColor, RectangleId } from "../domain/Element";
import type { RectanglePersistence } from "./RectanglePersistence";
export type { RectanglePersistence } from "./RectanglePersistence";

type Dependencies = { rectangles: RectanglePersistence };

/**
 * Check access, geometry, and capacity before creating a rectangle. The capacity
 * read and insertion must share a transaction to prevent concurrent overflow.
 */
export async function createRectangle(
  { rectangles }: Dependencies,
  actor: CanvasActor,
  input: { geometry: Geometry; color: RectangleColor },
): Promise<RectangleId> {
  assertCanvasAccess(actor);
  assertElementGeometry(input.geometry);
  if (
    (await rectangles.countUpTo(rectangleLimits.maxCount)) >=
    rectangleLimits.maxCount
  )
    throw new CanvasCapacityReached();
  return rectangles.insert(input);
}

/**
 * Authorize and validate a geometry replacement. Return false after deletion
 * so late gestures cannot resurrect records; server transaction order wins.
 */
export async function updateRectangleGeometry(
  { rectangles }: Dependencies,
  actor: CanvasActor,
  id: RectangleId,
  geometry: Geometry,
  generation: number,
): Promise<boolean> {
  assertCanvasAccess(actor);
  assertElementGeometry(geometry);
  const element = await rectangles.get(id);
  if (!element || element.removed || element.generation !== generation)
    return false;
  // Server transaction order decides the winner. Updating never creates a record.
  await rectangles.updateGeometry(id, geometry);
  return true;
}
