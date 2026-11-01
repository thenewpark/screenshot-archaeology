/** Bit-grid collision checks and ordered placement search. No DOM or image work. */
import { PACKING, BITS_PER_WORD, WORD_SHIFT, WORD_BIT_MASK } from "./packing-policy.js";
const PAIR_WIDTH = 2;

export function createGrid(region) {
  const columns = Math.floor(region.width / PACKING.cellSizeMm);
  const rows = Math.floor(region.height / PACKING.cellSizeMm);
  return Object.freeze({ columns, rows, stride: Math.ceil(columns / BITS_PER_WORD) });
}

export function hasCollision(occupied, bits, offset) {
  for (let index = 0; index < bits.length; index += PAIR_WIDTH) {
    if (occupied[offset + bits[index]] & bits[index + 1]) {
      return true;
    }
  }
  return false;
}

export function occupy(occupied, shape, point, grid) {
  const bits = shape.variants[point.x & WORD_BIT_MASK];
  const offset = point.y * grid.stride + (point.x >>> WORD_SHIFT);
  for (let index = 0; index < bits.length; index += PAIR_WIDTH) {
    occupied[offset + bits[index]] |= bits[index + 1];
  }
}

function placementScore(shape, x, y) {
  return (
    y +
    shape.h +
    Math.abs(shape.angle) * PACKING.anglePenalty +
    x * PACKING.horizontalPenalty
  );
}

function findFreeColumn(occupied, shape, y, grid) {
  for (let x = 0; x <= grid.columns - shape.w; x += 1) {
    const bits = shape.variants[x & WORD_BIT_MASK];
    const offset = y * grid.stride + (x >>> WORD_SHIFT);
    if (hasCollision(occupied, bits, offset)) {
      continue;
    }
    return { x, y, score: placementScore(shape, x, y) };
  }
  return null;
}

export function locate(occupied, shape, grid, bestScore = Infinity) {
  if (shape.w > grid.columns || shape.h > grid.rows) {
    return null;
  }
  for (let y = 0; y <= grid.rows - shape.h && y + shape.h <= bestScore; y += 1) {
    const candidate = findFreeColumn(occupied, shape, y, grid);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}
