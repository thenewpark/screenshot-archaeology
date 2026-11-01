export class RenderingHost {
  #isLiveCanvas;
  constructor(isLiveCanvas) {
    this.#isLiveCanvas = isLiveCanvas;
  }
  #renderer = null;

  register(renderer) {
    this.#renderer = renderer;
  }

  paint(view, context, interactive, drawScene, format = "poster") {
    if (!this.#renderer) {
      return drawScene();
    }

    const liveCanvas = this.#isLiveCanvas(context.canvas);

    if (liveCanvas && interactive && !this.#renderer.isDrawing()) {
      this.#renderer.request();
      return;
    }

    return this.#renderer.paint(view, context, interactive, drawScene, format);
  }

  element(kind, context, model, fallback) {
    if (!this.#renderer?.element(kind, context, model)) {
      fallback();
    }
  }

  get layoutOptions() {
    return this.#renderer?.layoutOptions() || {};
  }

  async flush() {
    await this.#renderer?.flush();
  }
}
