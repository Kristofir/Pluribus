import { geometryLimits } from "@pluribus/core/canvas/domain";

export type ImageCardSize = { width: number; height: number };

export const defaultImageCardSize: ImageCardSize = {
  width: 360,
  height: 276,
};

/** Match the source image while keeping the initial card usable and in canvas bounds. */
export function imageCardSize(
  naturalWidth: number,
  naturalHeight: number,
): ImageCardSize {
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  )
    return defaultImageCardSize;

  const scale = Math.min(
    Math.max(
      360 / Math.max(naturalWidth, naturalHeight),
      180 / naturalWidth,
      160 / naturalHeight,
    ),
    geometryLimits.maxSize / Math.max(naturalWidth, naturalHeight),
  );
  return {
    width: Math.max(
      geometryLimits.minSize,
      Math.min(geometryLimits.maxSize, Math.round(naturalWidth * scale)),
    ),
    height: Math.max(
      geometryLimits.minSize,
      Math.min(geometryLimits.maxSize, Math.round(naturalHeight * scale)),
    ),
  };
}

export function imageCardSizeFromUrl(url: string): Promise<ImageCardSize> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = () => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error("Could not read image dimensions."));
    }, 5_000);
    image.onload = () => {
      finish();
      resolve(imageCardSize(image.naturalWidth, image.naturalHeight));
    };
    image.onerror = () => {
      finish();
      reject(new Error("Could not read image dimensions."));
    };
    image.src = url;
  });
}
