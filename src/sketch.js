import { SETTINGS } from "./config.js";
import { createPosterDrawers } from "./screenshot-archaeology/rendering/p5-elements.js";
import { ScreenshotWorkshop } from "./screenshot-archaeology/engine.js";
import { ScreenshotStudio } from "./screenshot-archaeology/p5-runtime.js";

// Screenshot Archaeology · a p5.js poster made from your screenshots
// Open analysis JSON → edit src/config.js or src/screenshot-archaeology/rendering/p5-elements.js → reload

// Settings live in src/config.js; drawing callbacks live in src/screenshot-archaeology/rendering/p5-elements.js.

// Poster drawing is separate from this lifecycle entry point.
// p provides p5 drawing tools: p.image(), p.line(), p.text().
// Poster coordinates are in mm. Landscape A4: 297 × 210; portrait: 210 × 297.
// Internal helpers load images, arrange items, connect originals and export files.

// Lifecycle: setup initializes resources; draw paints only when requested.

const workshop = new ScreenshotStudio(
  ScreenshotWorkshop,
  SETTINGS,
  createPosterDrawers(SETTINGS),
);

// p5 owns only the poster drawing lifecycle, not page layout or DOM controls.
new globalThis.p5((p) => {
  p.setup = () => workshop.setup(p);
  p.draw = () => workshop.draw();
  p.windowResized = () => workshop.request();
});
