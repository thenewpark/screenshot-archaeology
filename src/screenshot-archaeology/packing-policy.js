/** Existing packing policy; names expose units without changing its values. */
export const PACKING = Object.freeze({
  cellSizeMm: 1.25,
  samplingSizePx: 96,
  minimumAlpha: 8,
  minimumCoverage: 0.05,
  rasterPaddingPx: 2,
  weightExponent: 2,
  scaleUpperBound: 1.15,
  searchAttempts: 10,
  yieldEveryItems: 8,
  anglePenalty: 0.012,
  horizontalPenalty: 0.002,
});
export const ROTATION_ANGLES = Object.freeze([0, -12, 12, -24, 24, 90, -90, 180]);
export const BITS_PER_WORD = 32;
export const WORD_SHIFT = Math.log2(BITS_PER_WORD);
export const WORD_BIT_MASK = BITS_PER_WORD - 1;
export const RGBA = Object.freeze({ channels: 4, alpha: 3 });
export const HALF_TURN_DEGREES = 180;
export const DILATION_OFFSETS = Object.freeze(
  [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => Object.freeze({ dx, dy }))),
);
