const page = { width: 297, height: 210 },
  area = { x: 8, y: 64, w: 281, h: 131 };
const polygon = (r) => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

function overlaps(a, b) {
  for (const p of [a, b]) {
    for (let i = 0; i < p.length; i++) {
      const u = p[i],
        v = p[(i + 1) % p.length],
        ax = -(v.y - u.y),
        ay = v.x - u.x;
      const aa = a.map((q) => q.x * ax + q.y * ay),
        bb = b.map((q) => q.x * ax + q.y * ay);

      if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) {
        return false;
      }
    }
  }
  return true;
}

function wrap(text, maxWidth, measure) {
  const words = String(text).trim().split(/\s+/),
    lines = [];
  let line = "";

  for (const word of words) {
    if (measure(word) > maxWidth) {
      if (line) {
        lines.push(line);
      }
      let part = "";

      for (const ch of Array.from(word)) {
        if (part && measure(part + ch) > maxWidth) {
          lines.push(part);
          part = "";
        }
        part += ch;
      }
      line = part;
    } else if (line && measure(line + " " + word) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line += (line ? " " : "") + word;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function legend(groups, measure) {
  const columns = 4,
    rows = Math.max(1, Math.ceil(groups.length / columns)),
    height = 8 * rows,
    cellWidth = area.w / columns;
  const cells = groups.map((g, i) => {
    let size = 3;

    while (size > 2.1 && measure(g.label, size) > cellWidth - 4) {
      size -= 0.05;
    }
    const lines = wrap(g.label, cellWidth - 4, (t) => measure(t, size));

    return {
      ...g,
      x: area.x + (i % columns) * cellWidth,
      y: 24 + Math.floor(i / columns) * 8,
      w: cellWidth,
      h: 8,
      size,
      lines,
    };
  });

  return { cells, x: area.x, y: 24, w: area.w, h: height, columns, rows };
}

function layout(
  items,
  relations,
  coordinates,
  measure,
  legendBottom = 56,
  options = {},
) {
  const bounds = { ...area, y: Math.max(area.y, legendBottom + 7) };

  bounds.h = 195 - bounds.y;
  const values = items.map(
    (item, i) =>
      coordinates[item.id] || [
        Math.cos(i * 2.399) * Math.sqrt(i + 1),
        Math.sin(i * 2.399) * Math.sqrt(i + 1),
      ],
  );
  const xs = values.map((p) => p[0]),
    ys = values.map((p) => p[1]),
    minX = Math.min(...xs),
    minY = Math.min(...ys),
    rangeX = Math.max(...xs) - minX || 1,
    rangeY = Math.max(...ys) - minY || 1;
  const nodes = items.map((item, i) => {
    const h = 16 * (options.thumbnailScale || 1),
      w = Math.min(20 * (options.thumbnailScale || 1), (h * item.width) / item.height);

    return {
      id: item.id,
      x: bounds.x + 12 + ((values[i][0] - minX) / rangeX) * (bounds.w - 24),
      y: bounds.y + 12 + ((values[i][1] - minY) / rangeY) * (bounds.h - 24),
      w,
      h,
    };
  });
  const clamp = (n) => {
    n.x = Math.max(bounds.x + n.w / 2, Math.min(bounds.x + bounds.w - n.w / 2, n.x));
    n.y = Math.max(bounds.y + n.h / 2, Math.min(195 - n.h / 2, n.y));
  };
  // Minimal local separation, without snapping to cells or regrouping the original constellation.

  for (let pass = 0; pass < 1000; pass++) {
    let changed = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          ox = (a.w + b.w) / 2 + 4 - Math.abs(dx),
          oy = (a.h + b.h) / 2 + 4 - Math.abs(dy);

        if (ox <= 0 || oy <= 0) {
          continue;
        }
        changed = true;
        if (ox < oy) {
          const push = ((ox + 0.02) / 2) * (dx < 0 ? -1 : 1);

          a.x -= push;
          b.x += push;
        } else {
          const push = ((oy + 0.02) / 2) * (dy < 0 ? -1 : 1);

          a.y -= push;
          b.y += push;
        }
        clamp(a);
        clamp(b);
      }
    }
    if (!changed) {
      break;
    }
  }
  const map = new Map(nodes.map((n) => [n.id, n]));
  const obstacles = nodes.map((n) =>
    polygon({
      x: n.x - n.w / 2 - 1,
      y: n.y - n.h / 2 - 1,
      w: n.w + 2,
      h: n.h + 2,
    }),
  );
  const labels = [],
    edges = [],
    unplaced = [];

  function candidate(x, y, angle, lines, size) {
    const w = Math.max(...lines.map((t) => measure(t, size))) + 2,
      h = lines.length * size * 1.18 + 1.4,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const corners = polygon({ x: -w / 2, y: -h - 0.8, w, h }).map((p) => ({
      x: x + p.x * c - p.y * s,
      y: y + p.x * s + p.y * c,
    }));

    return { x, y, angle, lines, size, w, h, corners };
  }

  function clear(box) {
    return (
      box.corners.every(
        (p) =>
          p.x >= bounds.x &&
          p.x <= bounds.x + bounds.w &&
          p.y >= bounds.y &&
          p.y <= 195,
      ) && !obstacles.some((p) => overlaps(p, box.corners))
    );
  }

  function endpoint(a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      l = Math.hypot(dx, dy) || 1,
      k =
        Math.min(
          Math.abs(dx) < 1e-8 ? Infinity : a.w / 2 / Math.abs(dx),
          Math.abs(dy) < 1e-8 ? Infinity : a.h / 2 / Math.abs(dy),
        ) +
        1 / l;

    return { x: a.x + dx * k, y: a.y + dy * k };
  }

  function findAlongLine(lines, size, start, end, angle) {
    for (const offset of [0, 4, -4, 8, -8, 13, -13, 19, -19, 26, -26]) {
      for (const t of [0.5, 0.35, 0.65, 0.22, 0.78]) {
        const anchor = {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        };
        const box = candidate(
          anchor.x - Math.sin(angle) * offset,
          anchor.y + Math.cos(angle) * offset,
          angle,
          lines,
          size,
        );
        if (clear(box)) {
          return { ...box, leader: offset ? anchor : null };
        }
      }
    }
    return null;
  }

  function findRelationLabel(label, length, start, end, angle) {
    const options = [2.8, 2.65, 2.5].flatMap((size) =>
      [Math.min(62, Math.max(27, length - 3)), 49].map((width) => ({ size, width })),
    );
    for (const { size, width } of options) {
      const lines = wrap(label, width, (text) => measure(text, size));
      if (lines.length > 2) {
        continue;
      }
      const box = findAlongLine(lines, size, start, end, angle);
      if (box) {
        return box;
      }
    }
    return null;
  }

  function findFallbackLabel(relation, start, end) {
    const candidates = [],
      lines = wrap(relation.label, 49, (t) => measure(t, 2.5));

    for (let y = bounds.y + 8; y < 194; y += 4) {
      for (let x = bounds.x + 27; x < bounds.x + bounds.w - 25; x += 4) {
        const c = candidate(x, y, 0, lines, 2.5);

        if (!clear(c)) {
          continue;
        }
        const dx = end.x - start.x,
          dy = end.y - start.y,
          t = Math.max(
            0,
            Math.min(
              1,
              ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy || 1),
            ),
          ),
          anchor = { x: start.x + dx * t, y: start.y + dy * t };

        candidates.push({
          ...c,
          leader: anchor,
          cost: Math.hypot(x - anchor.x, y - anchor.y),
        });
      }
    }
    return candidates.sort((a, b) => a.cost - b.cost)[0];
  }

  const ordered = [...relations].sort((a, b) => b.label.length - a.label.length);

  for (const relation of ordered) {
    const a = map.get(relation.source),
      b = map.get(relation.target),
      start = endpoint(a, b),
      end = endpoint(b, a),
      length = Math.hypot(end.x - start.x, end.y - start.y);
    let angle = Math.atan2(end.y - start.y, end.x - start.x);

    if (angle > Math.PI / 2) {
      angle -= Math.PI;
    }
    if (angle < -Math.PI / 2) {
      angle += Math.PI;
    }
    const points = [start, end];

    let box = findRelationLabel(relation.label, length, start, end, angle);
    if (!box) {
      box = findFallbackLabel(relation, start, end);
    }
    if (box) {
      obstacles.push(box.corners);
      labels.push({ ...box, text: relation.label, relation });
    } else {
      unplaced.push(relation.id);
    }
    edges.push({ relation, points });
  }
  return { nodes, labels, edges, unplaced, bounds };
}

export const ConstellationPoster = {
  page,
  area,
  wrap,
  legend,
  layout,
  polygon,
  overlaps,
};
export default ConstellationPoster;
