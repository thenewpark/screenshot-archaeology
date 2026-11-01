const PAGE = Object.freeze({ widthMm: 210, heightMm: 297 });
const HANDLE = Object.freeze({
  offsetPx: 18,
  edgePaddingMm: 2,
  mouseRadiusPx: 8,
  touchRadiusPx: 15,
});
const ANGLES = Object.freeze({
  halfTurn: 180,
  fullTurn: 360,
  snapStep: 15,
  cursorSector: 45,
});
const MINIMUM_RESIZE_FACTOR = 0.08;
const DIRECTION_EPSILON = 1e-9;
const signs = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function turn(x, y, degrees) {
  const r = (degrees * Math.PI) / ANGLES.halfTurn;

  return {
    x: x * Math.cos(r) - y * Math.sin(r),
    y: x * Math.sin(r) + y * Math.cos(r),
  };
}

function center(p) {
  return { x: p.xMm + p.widthMm / 2, y: p.yMm + p.heightMm / 2 };
}

function corners(p) {
  const c = center(p);

  return signs.map(([sx, sy]) => {
    const d = turn((sx * p.widthMm) / 2, (sy * p.heightMm) / 2, p.rotation);

    return { x: c.x + d.x, y: c.y + d.y };
  });
}

function controls(p, mmPerPixel) {
  const c = center(p),
    d = turn(0, -p.heightMm / 2 - HANDLE.offsetPx * mmPerPixel, p.rotation),
    top = turn(0, -p.heightMm / 2, p.rotation);

  return {
    corners: corners(p),
    rotation: {
      x: Math.max(
        HANDLE.edgePaddingMm,
        Math.min(PAGE.widthMm - HANDLE.edgePaddingMm, c.x + d.x),
      ),
      y: Math.max(
        HANDLE.edgePaddingMm,
        Math.min(PAGE.heightMm - HANDLE.edgePaddingMm, c.y + d.y),
      ),
    },
    stem: { x: c.x + top.x, y: c.y + top.y },
  };
}

function hit(p, point, mmPerPixel, touch = false, withRotation = true) {
  const h = controls(p, mmPerPixel),
    radius = (touch ? HANDLE.touchRadiusPx : HANDLE.mouseRadiusPx) * mmPerPixel;

  if (
    withRotation &&
    Math.hypot(point.x - h.rotation.x, point.y - h.rotation.y) <= radius
  ) {
    return { kind: "rotate" };
  }
  const corner = h.corners.findIndex(
    (c) => Math.hypot(point.x - c.x, point.y - c.y) <= radius,
  );

  return corner < 0 ? null : { kind: "resize", corner };
}

function axisScaleLimit(direction, anchor, origin, length) {
  if (direction > DIRECTION_EPSILON) {
    return (origin + length - anchor) / direction;
  }
  if (direction < -DIRECTION_EPSILON) {
    return (origin - anchor) / direction;
  }
  return Infinity;
}

function maximumResizeFactor(pose, sx, sy, anchor, limits) {
  return signs
    .map(([cx, cy]) =>
      turn(
        ((cx + sx) * pose.widthMm) / 2,
        ((cy + sy) * pose.heightMm) / 2,
        pose.rotation,
      ),
    )
    .flatMap((direction) => [
      axisScaleLimit(direction.x, anchor.x, limits.x, limits.width),
      axisScaleLimit(direction.y, anchor.y, limits.y, limits.height),
    ])
    .reduce((minimum, factor) => Math.min(minimum, factor), Infinity);
}

function resize(
  p,
  corner,
  point,
  limits = { x: 0, y: 0, width: PAGE.widthMm, height: PAGE.heightMm },
) {
  const [sx, sy] = signs[corner],
    anchor = corners(p)[(corner + 2) % 4],
    delta = turn(point.x - anchor.x, point.y - anchor.y, -p.rotation),
    vx = sx * p.widthMm,
    vy = sy * p.heightMm;
  const requestedFactor = (delta.x * vx + delta.y * vy) / (vx * vx + vy * vy);
  const maximum = maximumResizeFactor(p, sx, sy, anchor, limits);
  const factor = Math.max(
    Math.min(MINIMUM_RESIZE_FACTOR, maximum),
    Math.min(maximum, requestedFactor),
  );
  const widthMm = p.widthMm * factor,
    heightMm = p.heightMm * factor,
    d = turn((sx * widthMm) / 2, (sy * heightMm) / 2, p.rotation);

  return {
    ...p,
    widthMm,
    heightMm,
    xMm: anchor.x + d.x - widthMm / 2,
    yMm: anchor.y + d.y - heightMm / 2,
  };
}

function rotate(p, startPoint, point, snap = false) {
  const c = center(p),
    angle =
      p.rotation +
      ((Math.atan2(point.y - c.y, point.x - c.x) -
        Math.atan2(startPoint.y - c.y, startPoint.x - c.x)) *
        180) /
        Math.PI;
  const result = snap ? Math.round(angle / ANGLES.snapStep) * ANGLES.snapStep : angle;

  return (
    ((((result + ANGLES.halfTurn) % ANGLES.fullTurn) + ANGLES.fullTurn) %
      ANGLES.fullTurn) -
    ANGLES.halfTurn
  );
}

function cursor(p, corner) {
  const [sx, sy] = signs[corner],
    d = turn(sx, sy, p.rotation),
    angle = ((Math.atan2(d.y, d.x) * 180) / Math.PI + 180) % 180;

  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][
    Math.round(angle / ANGLES.cursorSector) % signs.length
  ];
}

export const TraceTransform = {
  center,
  corners,
  controls,
  hit,
  resize,
  rotate,
  cursor,
};
export default TraceTransform;
