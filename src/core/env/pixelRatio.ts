export const MAX_RENDER_PIXEL_RATIO = 2;

export function clampPixelRatio(
  pixelRatio: number,
  maximum = MAX_RENDER_PIXEL_RATIO,
): number {
  if (!Number.isFinite(pixelRatio)) {
    return 1;
  }

  return Math.min(Math.max(pixelRatio, 1), Math.max(maximum, 1));
}
