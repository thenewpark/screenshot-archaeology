/** Rasterize original image alpha into compact, shifted collision masks. */
import {
  PACKING,
  RGBA,
  HALF_TURN_DEGREES,
  DILATION_OFFSETS,
  BITS_PER_WORD,
  WORD_SHIFT,
  WORD_BIT_MASK,
} from "./packing-policy.js";
const createCanvas = () => document.createElement("canvas");

function createSurface(width, height, factory = createCanvas) {
  const canvas = factory();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return { canvas, context };
}

export function alphaCoverage(image, factory = createCanvas) {
  const size = PACKING.samplingSizePx;
  const { context } = createSurface(size, size, factory);
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  let opaquePixels = 0;
  for (let index = RGBA.alpha; index < pixels.length; index += RGBA.channels) {
    if (pixels[index] > PACKING.minimumAlpha) {
      opaquePixels += 1;
    }
  }
  return Math.max(PACKING.minimumCoverage, opaquePixels / (size * size));
}

function markNeighbors(mask, width, height, x, y) {
  DILATION_OFFSETS.forEach(({ dx, dy }) => {
    const column = x + dx,
      row = y + dy;
    if (column < 0 || column >= width || row < 0 || row >= height) {
      return;
    }
    mask[row * width + column] = 1;
  });
}

export function dilateAlpha(pixels, width, height) {
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    if (pixels[index * RGBA.channels + RGBA.alpha] <= PACKING.minimumAlpha) {
      continue;
    }
    markNeighbors(mask, width, height, index % width, Math.floor(index / width));
  }
  return mask;
}

function encodeRow(mask, width, row, shift, stride) {
  const words = new Uint32Array(Math.ceil((width + shift) / BITS_PER_WORD));
  for (let column = 0; column < width; column += 1) {
    if (!mask[row * width + column]) {
      continue;
    }
    const bit = column + shift;
    words[bit >>> WORD_SHIFT] |= 1 << (bit & WORD_BIT_MASK);
  }
  return Array.from(words).flatMap((word, index) =>
    word ? [row * stride + index, word] : [],
  );
}

export function encodeVariants(mask, width, height, stride) {
  // Preserve the original stable middle-row-first collision ordering.
  const rowOrder = Array.from({ length: height }, (_, row) => row).sort(
    (a, b) => Math.abs(a - height / 2) - Math.abs(b - height / 2),
  );
  return Array.from({ length: BITS_PER_WORD }, (_, shift) =>
    rowOrder.flatMap((row) => encodeRow(mask, width, row, shift, stride)),
  );
}

export function rasterizeShape(
  image,
  imageWidth,
  imageHeight,
  angle,
  stride,
  factory = createCanvas,
) {
  const radians = (angle * Math.PI) / HALF_TURN_DEGREES;
  const width =
    Math.ceil(
      Math.abs(imageWidth * Math.cos(radians)) +
        Math.abs(imageHeight * Math.sin(radians)),
    ) + PACKING.rasterPaddingPx;
  const height =
    Math.ceil(
      Math.abs(imageWidth * Math.sin(radians)) +
        Math.abs(imageHeight * Math.cos(radians)),
    ) + PACKING.rasterPaddingPx;
  const { context } = createSurface(width, height, factory);
  context.translate(width / 2, height / 2);
  context.rotate(radians);
  context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
  const pixels = context.getImageData(0, 0, width, height).data;
  const mask = dilateAlpha(pixels, width, height);
  return {
    w: width,
    h: height,
    variants: encodeVariants(mask, width, height, stride),
    angle,
    iw: imageWidth,
    ih: imageHeight,
  };
}
