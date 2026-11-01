const INTERACTION = Object.freeze({
  pageWidthMm: 210,
  pageHeightMm: 297,
  maskResolutionPx: 96,
  rgbaChannelCount: 4,
  alphaChannelIndex: 3,
  minimumHitAlpha: 8,
  primaryPointerButton: 0,
  keyboardStepMm: 1,
  keyboardFastStepMm: 5,
});
const KEY_DIRECTIONS = Object.freeze({
  ArrowLeft: Object.freeze({ x: -1, y: 0 }),
  ArrowRight: Object.freeze({ x: 1, y: 0 }),
  ArrowUp: Object.freeze({ x: 0, y: -1 }),
  ArrowDown: Object.freeze({ x: 0, y: 1 }),
});
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/** Owns poster pointer/keyboard events, not layout or archive persistence. */
function createCollageInteraction({
  canvas,
  getState,
  getObjects,
  getPlacement,
  getImage,
  transforms,
  getContentBounds,
  getBaseBoxes,
  editObject,
  inspect,
  render,
  createCanvas = () => document.createElement("canvas"),
}) {
  const masks = new Map();
  let gesture = null;
  const mmPerPixel = () =>
    INTERACTION.pageWidthMm / canvas.getBoundingClientRect().width;
  const available = () => Boolean(getState().archive) && !getState().packing;
  const toPosterPoint = ({ clientX, clientY }) => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((clientX - bounds.left) / bounds.width) * INTERACTION.pageWidthMm,
      y: ((clientY - bounds.top) / bounds.height) * INTERACTION.pageHeightMm,
    };
  };
  function maskFor(object) {
    if (masks.has(object.id)) {
      return masks.get(object.id);
    }
    const size = INTERACTION.maskResolutionPx;
    const surface = createCanvas();
    surface.width = size;
    surface.height = size;
    const context = surface.getContext("2d", { willReadFrequently: true });
    context.drawImage(getImage(object.id), 0, 0, size, size);
    const mask = context.getImageData(0, 0, size, size).data;
    masks.set(object.id, mask);
    return mask;
  }
  function containsOpaquePixel(object, point) {
    const pose = getPlacement(object),
      centre = transforms.center(pose);
    const radians = (-pose.rotation * Math.PI) / 180;
    const dx = point.x - centre.x,
      dy = point.y - centre.y;
    const local = {
      x: dx * Math.cos(radians) - dy * Math.sin(radians),
      y: dx * Math.sin(radians) + dy * Math.cos(radians),
    };
    if (Math.abs(local.x) > pose.widthMm / 2 || Math.abs(local.y) > pose.heightMm / 2) {
      return false;
    }
    const size = INTERACTION.maskResolutionPx;
    const pixel = (coordinate, length) =>
      clamp(Math.floor((coordinate / length + 0.5) * size), 0, size - 1);
    const index =
      (pixel(local.y, pose.heightMm) * size + pixel(local.x, pose.widthMm)) *
        INTERACTION.rgbaChannelCount +
      INTERACTION.alphaChannelIndex;
    return maskFor(object)[index] > INTERACTION.minimumHitAlpha;
  }
  function findHit(point, touch = false) {
    const { selected, archive } = getState();
    const objects = getObjects().filter((object) => !getPlacement(object).hidden);
    const selectedObject = objects.find(
      (object) => selected?.type === "object" && object.id === selected.id,
    );
    const controlFor = (object, withRotation = true) => {
      const control = transforms.hit(
        getPlacement(object),
        point,
        mmPerPixel(),
        touch,
        withRotation,
      );
      return control ? { object, ...control } : null;
    };
    if (selectedObject) {
      const hit = controlFor(selectedObject);
      if (hit) {
        return hit;
      }
    }
    const frontToBack = objects.toReversed();
    if (archive.participant.collageShowBounds) {
      const handle = frontToBack
        .filter((object) => object !== selectedObject)
        .map((object) => controlFor(object, false))
        .find(Boolean);
      if (handle) {
        return handle;
      }
    }
    const object = frontToBack.find((object) => containsOpaquePixel(object, point));
    return object ? { object, kind: "move" } : null;
  }
  function cursorFor(hit, dragging = false) {
    if (!hit) {
      return "default";
    }
    if (hit.kind === "resize") {
      return transforms.cursor(getPlacement(hit.object), hit.corner);
    }
    if (hit.kind === "rotate") {
      return dragging ? "grabbing" : "grab";
    }
    return "move";
  }
  function updateGesture(point, snap) {
    const { object, placement: start } = gesture;
    if (gesture.kind === "resize") {
      const resized = transforms.resize(
        start,
        gesture.corner,
        point,
        getContentBounds(),
      );
      const base = getBaseBoxes().find((box) => box.objectId === object.id);
      editObject(object, {
        scale: resized.widthMm / base.widthMm,
        xMm: resized.xMm,
        yMm: resized.yMm,
      });
      return;
    }
    if (gesture.kind === "rotate") {
      editObject(object, {
        rotation: transforms.rotate(start, gesture.point, point, snap),
      });
      return;
    }
    editObject(object, {
      xMm: start.xMm + point.x - gesture.point.x,
      yMm: start.yMm + point.y - gesture.point.y,
    });
  }
  function pointerDown(event) {
    if (!available() || event.button !== INTERACTION.primaryPointerButton) {
      return;
    }
    event.preventDefault();
    const point = toPosterPoint(event),
      hit = findHit(point, event.pointerType === "touch");
    inspect(hit ? { type: "object", id: hit.object.id } : null);
    if (hit) {
      gesture = { ...hit, point, placement: { ...getPlacement(hit.object) } };
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
    }
    render();
  }
  function pointerMove(event) {
    if (!available()) {
      return;
    }
    const point = toPosterPoint(event);
    if (!gesture) {
      canvas.style.cursor = cursorFor(findHit(point, event.pointerType === "touch"));
      return;
    }
    updateGesture(point, event.shiftKey);
    canvas.style.cursor = cursorFor(gesture, true);
  }
  function finishGesture() {
    if (gesture) {
      inspect({ type: "object", id: gesture.object.id });
    }
    gesture = null;
    canvas.style.cursor = "default";
    render();
  }
  function keyDown(event) {
    const { archive, selected } = getState();
    const direction = KEY_DIRECTIONS[event.key];
    if (!archive || selected?.type !== "object" || !direction) {
      return;
    }
    event.preventDefault();
    const object = archive.objects.find((object) => object.id === selected.id),
      pose = getPlacement(object);
    const step = event.shiftKey
      ? INTERACTION.keyboardFastStepMm
      : INTERACTION.keyboardStepMm;
    editObject(object, {
      xMm: pose.xMm + direction.x * step,
      yMm: pose.yMm + direction.y * step,
    });
    inspect(selected);
  }
  const events = {
    pointerdown: pointerDown,
    pointermove: pointerMove,
    pointerup: finishGesture,
    pointercancel: finishGesture,
    lostpointercapture: () => {
      if (gesture) {
        finishGesture();
      }
    },
    keydown: keyDown,
  };
  Object.entries(events).forEach(([name, handler]) =>
    canvas.addEventListener(name, handler),
  );
  canvas.tabIndex = 0;
  return Object.freeze({
    reset() {
      gesture = null;
      masks.clear();
      canvas.style.cursor = "default";
    },
    dispose() {
      Object.entries(events).forEach(([name, handler]) =>
        canvas.removeEventListener(name, handler),
      );
      masks.clear();
      gesture = null;
    },
    findHit,
  });
}

export { createCollageInteraction, INTERACTION };
