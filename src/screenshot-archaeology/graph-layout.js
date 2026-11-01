function shortLabel(value, limit = 28) {
  const chars = Array.from(
    String(value)
      .replace(/\s+/g, " ")
      .trim()
      .replace(
        /^(?:the\s+)?(?:post|screenshot|image)\s+(?:shows|features|includes|discusses)\s+/i,
        "",
      ),
  );

  return chars.length <= limit
    ? chars.join("")
    : chars
        .slice(0, Math.max(0, limit - 1))
        .join("")
        .trimEnd() + "…";
}

function spreadNodes(points, gap) {
  const out = points.map((p) => ({ ...p }));

  for (let step = 0; step < 600; step++) {
    let overlap = 0;

    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i],
          b = out[j],
          dx = b.x - a.x,
          dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + gap - Math.abs(dx),
          oy = (a.h + b.h) / 2 + gap - Math.abs(dy);

        if (ox <= 0 || oy <= 0) {
          continue;
        }
        overlap = Math.max(overlap, Math.min(ox, oy));
        if (ox < oy) {
          const move = ((ox + 0.05) / 2) * (dx < 0 ? -1 : 1);

          a.x -= move;
          b.x += move;
        } else {
          const move = ((oy + 0.05) / 2) * (dy < 0 ? -1 : 1);

          a.y -= move;
          b.y += move;
        }
      }
    }
    if (overlap < 0.1) {
      break;
    }
  }
  return out;
}

function edgeSegment(a, b, lane = 0) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);

  if (length < 1) {
    return null;
  }
  const ux = dx / length,
    uy = dy / length,
    nx = -uy,
    ny = ux;

  lane = Math.max(
    -Math.min(a.w, a.h, b.w, b.h) * 0.35,
    Math.min(Math.min(a.w, a.h, b.w, b.h) * 0.35, lane),
  );
  const exit = (p, vx, vy) =>
    Math.min(
      Math.abs(vx) < 1e-9
        ? Infinity
        : (p.w / 2 - Math.sign(vx) * nx * lane) / Math.abs(vx),
      Math.abs(vy) < 1e-9
        ? Infinity
        : (p.h / 2 - Math.sign(vy) * ny * lane) / Math.abs(vy),
    );
  const start = exit(a, ux, uy) + 7,
    end = exit(b, -ux, -uy) + 7;

  if (start + end >= length - 4) {
    return null;
  }
  let angle = Math.atan2(dy, dx);

  if (angle > Math.PI / 2) {
    angle -= Math.PI;
  }
  if (angle < -Math.PI / 2) {
    angle += Math.PI;
  }
  return {
    x1: a.x + nx * lane + ux * start,
    y1: a.y + ny * lane + uy * start,
    x2: b.x + nx * lane - ux * end,
    y2: b.y + ny * lane - uy * end,
    angle,
  };
}

function rectPolygon(r) {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

function labelBox(edge, width, height, t) {
  const x = edge.x1 + (edge.x2 - edge.x1) * t,
    y = edge.y1 + (edge.y2 - edge.y1) * t,
    c = Math.cos(edge.angle),
    s = Math.sin(edge.angle);
  const corners = rectPolygon({
    x: -width / 2 - 4,
    y: -height - 8,
    w: width + 8,
    h: height + 4,
  }).map((p) => ({ x: x + p.x * c - p.y * s, y: y + p.x * s + p.y * c }));

  return { x, y, angle: edge.angle, width, height, corners };
}

function polygonsOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length],
        axis = { x: -(q.y - p.y), y: q.x - p.x };
      const aa = a.map((v) => v.x * axis.x + v.y * axis.y),
        bb = b.map((v) => v.x * axis.x + v.y * axis.y);

      if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) {
        return false;
      }
    }
  }
  return true;
}

function findLabel(edge, width, height, obstacles, viewport) {
  for (const t of [0.5, 0.35, 0.65, 0.22, 0.78]) {
    const box = labelBox(edge, width, height, t);

    if (
      box.corners.some(
        (p) => p.x < 4 || p.y < 4 || p.x > viewport.w - 4 || p.y > viewport.h - 4,
      )
    ) {
      continue;
    }
    if (!obstacles.some((poly) => polygonsOverlap(poly, box.corners))) {
      return box;
    }
  }
  return null;
}

export const TraceGraph = {
  shortLabel,
  spreadNodes,
  edgeSegment,
  rectPolygon,
  labelBox,
  polygonsOverlap,
  findLabel,
};
export default TraceGraph;
