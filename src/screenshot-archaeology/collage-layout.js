/** Compose rasterization, collision search and scale search into a collage layout. */
import { PosterTemplate } from "./poster-template.js";
import { PACKING, ROTATION_ANGLES, HALF_TURN_DEGREES } from "./packing-policy.js";
import { alphaCoverage, rasterizeShape } from "./silhouette-raster.js";
import { createGrid, locate, occupy } from "./packing-grid.js";

const region = PosterTemplate.contentBounds;
const grid = createGrid(region);
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

export function bounds(pose) {
  const radians = (pose.rotation * Math.PI) / HALF_TURN_DEGREES;
  const width =
    Math.abs(pose.widthMm * Math.cos(radians)) +
    Math.abs(pose.heightMm * Math.sin(radians));
  const height =
    Math.abs(pose.widthMm * Math.sin(radians)) +
    Math.abs(pose.heightMm * Math.cos(radians));
  return {
    x: pose.xMm + pose.widthMm / 2 - width / 2,
    y: pose.yMm + pose.heightMm / 2 - height / 2,
    w: width,
    h: height,
  };
}

export function displayWeight(object, equal = false) {
  return equal ? 1 : (object.relativeAreaWeight || 1) ** PACKING.weightExponent;
}

function createSource(object, imageFor, totalWeight, equal) {
  const image = imageFor(object);
  const area =
    (region.width * region.height * displayWeight(object, equal)) /
    totalWeight /
    alphaCoverage(image);
  const ratio = image.naturalWidth / image.naturalHeight;
  return {
    id: object.id,
    image,
    w: Math.sqrt(area * ratio),
    h: Math.sqrt(area / ratio),
  };
}

function createSources(objects, imageFor, equal) {
  const totalWeight = objects.reduce(
    (total, object) => total + displayWeight(object, equal),
    0,
  );
  return objects
    .map((object) => createSource(object, imageFor, totalWeight, equal))
    .sort(
      (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || a.id.localeCompare(b.id),
    );
}

function chooseOrientation(source, factor, occupied) {
  const width = Math.max(1, Math.round((source.w * factor) / PACKING.cellSizeMm));
  const height = Math.max(1, Math.round((source.h * factor) / PACKING.cellSizeMm));
  return ROTATION_ANGLES.reduce((best, angle) => {
    const shape = rasterizeShape(source.image, width, height, angle, grid.stride);
    const point = locate(occupied, shape, grid, best?.score);
    return point && (!best || point.score < best.score) ? { ...point, shape } : best;
  }, null);
}

function placementFor(source, factor, { x, y, shape }) {
  const width = source.w * factor,
    height = source.h * factor;
  return {
    objectId: source.id,
    xMm: region.x + (x + shape.w / 2) * PACKING.cellSizeMm - width / 2,
    yMm: region.y + (y + shape.h / 2) * PACKING.cellSizeMm - height / 2,
    widthMm: width,
    heightMm: height,
    rotation: shape.angle,
  };
}

async function packAtScale(sources, factor) {
  // Mutation is private to one trial: inputs and previously accepted trials stay untouched.
  const occupied = new Uint32Array(grid.stride * grid.rows);
  const placements = [];
  for (const [index, source] of sources.entries()) {
    const choice = chooseOrientation(source, factor, occupied);
    if (!choice) {
      return null;
    }
    occupy(occupied, choice.shape, choice, grid);
    placements.push(placementFor(source, factor, choice));
    if ((index + 1) % PACKING.yieldEveryItems === 0) {
      await yieldToBrowser();
    }
  }
  return placements;
}

async function searchScale(sources, onProgress) {
  let search = { lower: 0, upper: PACKING.scaleUpperBound, placements: null };
  for (let attempt = 0; attempt < PACKING.searchAttempts; attempt += 1) {
    const factor = (search.lower + search.upper) / 2;
    const placements = await packAtScale(sources, factor);
    search = placements
      ? { ...search, lower: factor, placements }
      : { ...search, upper: factor };
    onProgress(attempt + 1);
    await yieldToBrowser();
  }
  return search.placements;
}

function centrePlacements(placements) {
  const boxes = placements.map(bounds);
  const left = Math.min(...boxes.map((box) => box.x)),
    top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w)),
    bottom = Math.max(...boxes.map((box) => box.y + box.h));
  const offset = {
    x: region.x + (region.width - right + left) / 2 - left,
    y: region.y + (region.height - bottom + top) / 2 - top,
  };
  return placements.map((pose) => ({
    ...pose,
    xMm: pose.xMm + offset.x,
    yMm: pose.yMm + offset.y,
  }));
}

export async function pack(
  objects,
  imageFor,
  { equal = false, onProgress = () => {} } = {},
) {
  if (!objects.length) {
    return [];
  }
  const placements = await searchScale(
    createSources(objects, imageFor, equal),
    onProgress,
  );
  if (!placements) {
    throw Error("This arrangement could not fit. Reset the arrangement and try again.");
  }
  return centrePlacements(placements);
}

export const TraceCollage = Object.freeze({ pack, bounds, displayWeight });
export default TraceCollage;
