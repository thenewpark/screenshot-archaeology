import { themeLabels } from "./domain/theme-labels.js";
import { step } from "./domain/microcosm-motion.js";
import { MICROCOSM_BOUNDS as bounds } from "./domain/microcosm-policy.js";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Suggested exploration count; it is not an estimated number of natural classes. */
function defaultThemeCount(data) {
  const detailFactor = data.microcosm ? 1.3 : 1;
  return Math.min(
    8,
    Math.max(3, Math.round(Math.sqrt(data.items.length) * detailFactor)),
  );
}
function hash(value) {
  let n = 2166136261;
  for (const c of String(value)) {
    n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  }
  return (n >>> 0) / 4294967296;
}
function cosine(a, b) {
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? clamp(dot / Math.sqrt(aa * bb), -1, 1) : 0;
}
function averageDistance(left, right, distances) {
  let sum = 0;
  left.forEach((a) =>
    right.forEach((b) => {
      sum += distances[a][b];
    }),
  );
  return sum / (left.length * right.length);
}
function cluster(ids, vectors, count, compact = false) {
  const distances = ids.map((a) => ids.map((b) => 1 - cosine(vectors[a], vectors[b])));
  const groups = ids.map((_, i) => [i]);
  while (groups.length > count) {
    let best = Infinity,
      pair = null;
    const capacity = compact ? Math.ceil((ids.length / count) * 1.6) : Infinity;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (groups[i].length + groups[j].length > capacity) {
          continue;
        }
        const distance = averageDistance(groups[i], groups[j], distances);
        if (distance < best - 1e-12) {
          best = distance;
          pair = [i, j];
        }
      }
    }
    if (!pair) {
      return cluster(ids, vectors, count, false);
    }
    groups[pair[0]].push(...groups[pair[1]]);
    groups.splice(pair[1], 1);
  }
  return groups.map((g) => g.map((i) => ids[i]).sort());
}
function keywordLabels(groups, observations, total) {
  const global = new Map();
  for (const obs of observations.values()) {
    for (const term of new Set(obs.keywords || [])) {
      global.set(term.toLowerCase(), (global.get(term.toLowerCase()) || 0) + 1);
    }
  }
  const used = new Map();
  return groups.map((ids) => {
    const local = new Map(),
      original = new Map();
    for (const id of ids) {
      for (const term of new Set(observations.get(id)?.keywords || [])) {
        const key = term.toLowerCase().trim();
        if (!key || /^(image|text|post|screenshot|content|book)$/.test(key)) {
          continue;
        }
        local.set(key, (local.get(key) || 0) + 1);
        original.set(key, term);
      }
    }
    const terms = [...local.keys()].sort(
      (a, b) =>
        local.get(b) * Math.log(1 + total / global.get(b)) -
          local.get(a) * Math.log(1 + total / global.get(a)) || a.localeCompare(b),
    );
    const label = terms.length
      ? terms
          .slice(0, 2)
          .map((t) => original.get(t))
          .join(" / ")
      : "Unclassified sources";
    const repeat = (used.get(label) || 0) + 1;
    used.set(label, repeat);
    return {
      label: repeat === 1 ? label : `${label} · ${repeat}`,
      keywords: terms.slice(0, 3).map((t) => original.get(t)),
    };
  });
}
function build(
  data,
  {
    count = Math.min(6, Math.max(3, Math.round(Math.sqrt(data.items.length)))),
    snapshot: saved = null,
    lens = "combined",
    projectionMode = "umap",
  } = {},
) {
  const detailed = data.microcosm?.lenses?.[lens];
  if (detailed) {
    const details = new Map(data.microcosm.items.map((o) => [o.id, o]));
    data = {
      ...data,
      embeddings: {
        ...data.embeddings,
        fused: { vectors: detailed.vectors },
      },
      projections: {
        fused_pca: detailed.projections.pca,
        fused_umap: detailed.projections.umap,
      },
      observations: data.observations.map((o) => ({
        ...o,
        keywords: (lens === "combined"
          ? [
              ...(details.get(o.id)?.content || []),
              ...(details.get(o.id)?.visual || []),
            ]
          : details.get(o.id)?.[lens] || []
        ).map((e) => e.label),
      })),
    };
  }
  const ids = data.items.map((o) => o.id).sort(),
    items = new Map(data.items.map((o) => [o.id, o]));
  const vectors = data.embeddings?.fused?.vectors || {};
  const dims = vectors[ids[0]]?.length;
  const valid =
    dims > 0 &&
    ids.every(
      (id) =>
        Array.isArray(vectors[id]) &&
        vectors[id].length === dims &&
        vectors[id].every(Number.isFinite) &&
        vectors[id].some((v) => v !== 0),
    );
  count = clamp(Math.round(count) || 1, 1, ids.length);
  let memberships;
  if (valid) {
    memberships = cluster(ids, vectors, count, !!detailed);
  } else {
    const assigned = new Set();
    memberships = [];
    for (const group of data.groups || []) {
      const members = (group.itemIds || []).filter(
        (id) => items.has(id) && !assigned.has(id),
      );
      members.forEach((id) => assigned.add(id));
      if (members.length) {
        memberships.push(members);
      }
    }
    const rest = ids.filter((id) => !assigned.has(id));
    if (rest.length) {
      memberships.push(rest);
    }
  }
  const observations = new Map((data.observations || []).map((o) => [o.id, o]));
  const labels = themeLabels(
    data,
    lens,
    count,
    memberships,
    keywordLabels(memberships, observations, ids.length),
  );
  let projection =
    projectionMode !== "pca" && data.projections?.fused_umap?.coordinates
      ? "UMAP"
      : data.projections?.fused_pca?.coordinates
        ? "PCA"
        : "Display arrangement";
  const coordinates =
    (projection === "UMAP"
      ? data.projections.fused_umap.coordinates
      : data.projections?.fused_pca?.coordinates) || {};
  const points = ids.map((id, i) =>
    coordinates[id]?.length === 2 && coordinates[id].every(Number.isFinite)
      ? coordinates[id]
      : [Math.cos(i * 2.399), Math.sin(i * 2.399)],
  );
  if (
    !ids.every(
      (id) => coordinates[id]?.length === 2 && coordinates[id].every(Number.isFinite),
    )
  ) {
    projection = "Display arrangement";
  }
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    dx = Math.max(...xs) - minX || 1,
    dy = Math.max(...ys) - minY || 1;
  const positions = new Map(
    ids.map((id, i) => [
      id,
      {
        x: bounds.x + 32 + ((points[i][0] - minX) / dx) * (bounds.w - 64),
        y: bounds.y + 25 + ((points[i][1] - minY) / dy) * (bounds.h - 50),
      },
    ]),
  );
  const groups = memberships.map((itemIds, i) => ({
    id: "theme-" + Math.round(hash(itemIds.join("|")) * 1e9).toString(36),
    itemIds,
    ...labels[i],
    colorIndex: i,
    x: itemIds.reduce((s, id) => s + positions.get(id).x, 0) / itemIds.length,
    y: itemIds.reduce((s, id) => s + positions.get(id).y, 0) / itemIds.length,
    rx: 17 + Math.sqrt(itemIds.length) * 9,
    ry: 12 + Math.sqrt(itemIds.length) * 6,
  }));
  // Separate theme envelopes gently after projection; never overwrite saved coordinates.
  for (let pass = 0; pass < 160; pass++) {
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i],
          b = groups[j],
          vx = b.x - a.x,
          vy = b.y - a.y;
        const distance = Math.hypot(vx / (a.rx + b.rx + 5), vy / (a.ry + b.ry + 7));
        if (distance < 1) {
          const angle = Math.atan2(vy, vx) || (i + j + 1) * 2.399,
            push = (1 - distance) * 2;
          a.x -= Math.cos(angle) * push;
          a.y -= Math.sin(angle) * push;
          b.x += Math.cos(angle) * push;
          b.y += Math.sin(angle) * push;
        }
      }
    }
    for (const g of groups) {
      g.x = clamp(g.x, bounds.x + g.rx, bounds.x + bounds.w - g.rx);
      g.y = clamp(g.y, bounds.y + g.ry + 4, bounds.y + bounds.h - g.ry);
    }
  }
  const nodes = [];
  for (const group of groups) {
    group.itemIds.forEach((id, i) => {
      const item = items.get(id),
        size = Math.min(18 / item.width, 15 / item.height),
        angle = i * 2.399 + hash(group.id) * 6.28;
      const radius = Math.sqrt((i + 0.5) / group.itemIds.length) * 0.68;
      const velocity = hash(id + "velocity") * 6.28;
      const centre = {
        x:
          group.itemIds.reduce((v, k) => v + positions.get(k).x, 0) /
          group.itemIds.length,
        y:
          group.itemIds.reduce((v, k) => v + positions.get(k).y, 0) /
          group.itemIds.length,
      };
      const extent = Math.max(
        1,
        ...group.itemIds.map((k) =>
          Math.hypot(positions.get(k).x - centre.x, positions.get(k).y - centre.y),
        ),
      );
      const point = positions.get(id);
      const localX =
        group.itemIds.length > 1
          ? ((point.x - centre.x) / extent) * 0.7
          : Math.cos(angle) * radius;
      const localY =
        group.itemIds.length > 1
          ? ((point.y - centre.y) / extent) * 0.7
          : Math.sin(angle) * radius;
      nodes.push({
        id,
        groupId: group.id,
        x: group.x + localX * group.rx,
        y: group.y + localY * group.ry,
        w: item.width * size,
        h: item.height * size,
        vx: Math.cos(velocity) * 1.2,
        vy: Math.sin(velocity) * 1.2,
        phase: hash(id) * 6.28,
      });
    });
  }
  const state = {
    datasetId: data.datasetId,
    lens,
    detailed: !!detailed,
    groups,
    nodes,
    bounds: { ...bounds },
    vectors: valid ? vectors : {},
    count,
    projection,
    method: valid
      ? `Average linkage${detailed ? " with group size limit" : ""} · ${detailed ? lens + " detailed features" : "legacy image + text features"}`
      : "Saved groups / unclassified sources; feature clustering unavailable",
    time: 0,
  };
  // Only accept a complete, finite snapshot from this exact set and cluster count.
  if (
    saved?.datasetId === data.datasetId &&
    saved.count === count &&
    Object.keys(saved.positions || {}).length === nodes.length &&
    nodes.every((n) => {
      const p = saved.positions[n.id];
      return (
        p &&
        ["x", "y", "vx", "vy"].every((k) => Number.isFinite(p[k])) &&
        p.x >= bounds.x + n.w / 2 &&
        p.x <= bounds.x + bounds.w - n.w / 2 &&
        p.y >= bounds.y + n.h / 2 &&
        p.y <= bounds.y + bounds.h - n.h / 2
      );
    })
  ) {
    for (const node of nodes) {
      Object.assign(node, saved.positions[node.id]);
    }
    state.time = Number.isFinite(saved.time) ? saved.time : 0;
  }
  return state;
}

function snapshot(state) {
  return {
    datasetId: state.datasetId,
    count: state.count,
    time: state.time,
    positions: Object.fromEntries(
      state.nodes.map((n) => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]),
    ),
  };
}
function nearest(state, id, count = 2) {
  const a = state.vectors[id];
  if (!a) {
    return [];
  }
  return state.nodes
    .filter((n) => n.id !== id && state.vectors[n.id])
    .map((n) => ({ id: n.id, similarity: cosine(a, state.vectors[n.id]) }))
    .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))
    .slice(0, count);
}
function hull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) {
    return sorted;
  }
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x),
    lower = [],
    upper = [];
  for (const p of sorted) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  for (const p of sorted.slice().reverse()) {
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export const Microcosm = Object.freeze({
  build,
  step,
  snapshot,
  nearest,
  hull,
  defaultThemeCount,
});
export default Microcosm;
