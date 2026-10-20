export const MAX_PIXEL_RATIO = 1.5;
export const MAX_RENDER_PIXELS = 1920 * 1080;

/**
 * Converts a CSS size into a canvas backing size. The pixel ratio and total pixel count are
 * capped to keep the fragment shader cheap on high-DPI and very large screens.
 */
export function computeRenderSize(
  cssWidth,
  cssHeight,
  devicePixelRatio,
  { maxPixelRatio = MAX_PIXEL_RATIO, maxPixels = MAX_RENDER_PIXELS } = {},
) {
  const width = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 1;
  const height = Number.isFinite(cssHeight) && cssHeight > 0 ? cssHeight : 1;
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;

  let scale = Math.min(ratio, maxPixelRatio);
  const pixels = width * height * scale * scale;
  if (pixels > maxPixels) {
    scale *= Math.sqrt(maxPixels / pixels);
  }

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  };
}
