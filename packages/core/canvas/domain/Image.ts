/** Bounded, browser-uploaded images. Originals remain in Convex storage across Undo. */
export const imageLimits = {
  maxCount: 100,
  maxBytes: 10 * 1024 * 1024,
} as const;
export const imageTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
