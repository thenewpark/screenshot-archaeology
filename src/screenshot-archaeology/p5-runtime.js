import { A4 } from "./visual-config.js";
/** Expose original pixels as globalThis.p5.Element images without a second rasterization pass. */
class P5AssetLibrary {
  #images = new WeakMap();

  image(source) {
    if (this.#images.has(source)) {
      return this.#images.get(source);
    }

    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    const image = new globalThis.p5.Element(source);

    image.width = width;
    image.height = height;
    // p5.image and p5.tint both accept this original drawable source.
    image.canvas = source;
    this.#images.set(source, image);

    return image;
  }
}

/** Own p5 drawing targets, units and temporary export surfaces. */
class P5SurfaceManager {
  #facade;
  #studio;
  #collage;
  #tools = new WeakMap();

  constructor(facade, studio) {
    this.#facade = facade;
    this.#studio = studio;
  }

  createCanvases() {
    const field = this.#studio.canvas("constellation");
    const poster = this.#studio.canvas("collage");
    const saved = [field, poster].map((canvas) => ({
      canvas,
      parent: canvas.parentNode,
      id: canvas.id,
      style: canvas.getAttribute("style"),
      className: canvas.className,
    }));

    this.#facade.pixelDensity(1);
    this.#facade.createCanvas(600, 400, field);
    this.#collage = this.#facade.createGraphics(
      A4.portrait.widthPx,
      A4.portrait.heightPx,
      poster,
    );
    this.#collage.pixelDensity(1);

    for (const savedCanvas of saved) {
      this.#restoreElement(savedCanvas);
    }
  }

  #restoreElement({ canvas, parent, id, style, className }) {
    canvas.id = id;
    canvas.className = className;

    if (style === null) {
      canvas.removeAttribute("style");
    } else {
      canvas.setAttribute("style", style);
    }

    if (canvas.parentNode !== parent) {
      parent.append(canvas);
    }
  }

  acquire(context) {
    if (context.canvas === this.#studio.canvas("constellation")) {
      return { target: this.#facade, release() {} };
    }

    if (context.canvas === this.#studio.canvas("collage")) {
      return { target: this.#drawingTools(this.#collage), release() {} };
    }

    const graphics = this.#facade.createGraphics(
      context.canvas.width,
      context.canvas.height,
      context.canvas,
    );

    graphics.pixelDensity(1);

    return {
      target: this.#drawingTools(graphics),
      release: () => graphics.remove(),
    };
  }

  #drawingTools(graphics) {
    if (!this.#tools.has(graphics)) {
      const tools = new Proxy(graphics, {
        get: (target, name) => {
          const value = Reflect.get(target, name, target);

          if (value === undefined) {
            return this.#facade[name];
          }
          return typeof value === "function" ? value.bind(target) : value;
        },
      });

      this.#tools.set(graphics, tools);
    }

    return this.#tools.get(graphics);
  }

  frame(view, context, interactive, format = "poster") {
    const isPoster = format === "poster";

    return {
      data: this.#studio.data,
      view,
      format: isPoster ? "poster" : "explore",
      units: isPoster ? "mm" : "px",
      interactive,
      width: isPoster ? (view === "collage" ? 210 : 297) : context.canvas.clientWidth,
      height: isPoster ? (view === "collage" ? 297 : 210) : context.canvas.clientHeight,
    };
  }

  withCoordinates(target, context, frame, draw) {
    const matrix = context.getTransform();
    target.push();

    try {
      target.resetMatrix();
      // Native paint already includes print units, device density and camera.
      // p5 resetMatrix restores its own density: replace it, never scale twice.
      context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      draw();
    } finally {
      target.pop();
    }
  }
}

/** Dispatch actual scene elements to the participant's p5 drawing functions. */
class P5ScenePainter {
  #settings;
  #drawers;
  #assets;
  #surfaces;
  #activeSurface = null;

  constructor(settings, drawers, assets, surfaces) {
    this.#settings = settings;
    this.#drawers = drawers;
    this.#assets = assets;
    this.#surfaces = surfaces;
  }

  paint(view, context, interactive, drawScene, format) {
    const surface = this.#surfaces.acquire(context);
    const previous = this.#activeSurface;
    const frame = this.#surfaces.frame(view, context, interactive, format);

    this.#activeSurface = { ...surface, context, frame };

    try {
      context.lineCap = "butt";
      context.lineJoin = "miter";
      drawScene();
      this.#drawExtraLayer(view, context, surface.target, frame);
    } finally {
      this.#activeSurface = previous;
      surface.release();
    }
  }

  element(kind, context, model) {
    const drawer = this.#drawers[kind];

    if (!drawer || !this.#activeSurface) {
      return false;
    }

    const { target, frame } = this.#activeSurface;
    const element = model.image
      ? { ...model, image: this.#assets.image(model.image) }
      : model;

    this.#surfaces.withCoordinates(target, context, frame, () => {
      drawer(target, element, frame);
    });

    return true;
  }

  #drawExtraLayer(view, context, target, frame) {
    const callback =
      view === "collage"
        ? this.#settings.drawCollage
        : view === "microcosm"
          ? this.#settings.drawMicrocosm
          : this.#settings.drawConstellation;

    if (!callback) {
      return;
    }

    this.#surfaces.withCoordinates(target, context, frame, () =>
      callback(target, frame),
    );
  }
}

/** Public p5 lifecycle; scheduling and renderer implementation remain private. */
export class ScreenshotStudio {
  #studio;
  #settings;
  #drawers;
  #facade = null;
  #surfaces = null;
  #painter = null;
  #ready = false;
  #drawing = false;
  #scheduled = null;
  #pending = false;
  #frames = 0;

  constructor(studio, settings, drawers) {
    this.#studio = studio;
    this.#settings = settings;
    this.#drawers = drawers;

    studio.configure(settings);
    studio.registerRenderer({
      isDrawing: () => this.#drawing,
      request: () => this.request(),
      flush: () => this.flush(),
      paint: (...args) => this.#paint(...args),
      element: (...args) => this.#painter?.element(...args) || false,

      layoutOptions: () => ({
        thumbnailScale: settings.screenshotScale || 1,
      }),
    });
  }

  get ready() {
    return this.#ready;
  }
  get frames() {
    return this.#frames;
  }
  get settings() {
    return this.#settings;
  }

  setup(facade) {
    this.#facade = facade;
    this.#surfaces = new P5SurfaceManager(facade, this.#studio);
    this.#surfaces.createCanvases();
    this.#painter = new P5ScenePainter(
      this.#settings,
      this.#drawers,
      new P5AssetLibrary(),
      this.#surfaces,
    );

    facade.noLoop();
    this.#ready = true;
    this.#studio.enableImport?.();
    this.request();
  }

  draw() {
    if (!this.#ready || this.#drawing) {
      return;
    }

    this.#drawing = true;
    this.#frames++;

    try {
      this.#studio.refresh();
    } finally {
      this.#drawing = false;
    }
  }

  request() {
    this.#pending = true;
    if (!this.#ready || this.#drawing || this.#scheduled !== null) {
      return;
    }

    this.#scheduled = requestAnimationFrame(async () => {
      this.#scheduled = null;
      this.#pending = false;

      try {
        await this.#facade.redraw();
      } catch (error) {
        console.error(error);
        this.#studio.reportError(`Check your sketch: ${error.message}`);
      }

      if (this.#pending) {
        this.request();
      }
    });
  }

  async flush() {
    if (!this.#ready) {
      return;
    }
    if (this.#scheduled !== null) {
      cancelAnimationFrame(this.#scheduled);
    }

    this.#scheduled = null;
    this.#pending = false;
    await this.#facade.redraw();
  }

  #paint(view, context, interactive, drawScene, format) {
    if (!this.#ready) {
      return drawScene();
    }
    return this.#painter.paint(view, context, interactive, drawScene, format);
  }
}
