/** Rectangle capacity also bounds the shared read projection. */
export const rectangleLimits = { maxCount: 200 } as const;

export class CanvasCapacityReached extends Error {
  constructor() {
    super(
      `The canvas supports ${rectangleLimits.maxCount} rectangles. Delete one before adding another.`,
    );
  }
}
