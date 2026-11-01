import { MOTION, MICROCOSM_BOUNDS as bounds } from "./microcosm-policy.js";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const caches = new WeakMap();
function frameCache(state) {
  const cached = caches.get(state);
  if (cached?.nodes === state.nodes && cached.groupSource === state.groups) {
    return cached;
  }
  const next = {
    nodes: state.nodes,
    groupSource: state.groups,
    groups: new Map(state.groups.map((group) => [group.id, group])),
    accelerations: state.nodes.map(() => ({ ax: 0, ay: 0 })),
  };
  caches.set(state, next);
  return next;
}
export function step(state, elapsed) {
  const dt = clamp(elapsed || 0, 0, MOTION.maximumTimeStep);
  state.time += dt;
  const cache = frameCache(state);
  const accelerations = cache.accelerations;
  state.nodes.forEach((a, index) => {
    const group = cache.groups.get(a.groupId);
    let ax = (group.x - a.x) * MOTION.attraction,
      ay = (group.y - a.y) * MOTION.attraction,
      neighbours = 0,
      vx = 0,
      vy = 0;
    for (const b of state.nodes) {
      if (a === b) {
        continue;
      }
      const dx = a.x - b.x,
        dy = a.y - b.y,
        distance = Math.hypot(dx, dy);
      if (a.groupId === b.groupId && distance < MOTION.alignmentRadius) {
        vx += b.vx;
        vy += b.vy;
        neighbours++;
      }
      const ox = (a.w + b.w) / 2 + MOTION.collisionGap - Math.abs(dx),
        oy = (a.h + b.h) / 2 + MOTION.collisionGap - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        if (ox < oy) {
          ax +=
            (dx < 0 ? -1 : 1) *
            Math.min(MOTION.maximumRepulsion, ox * MOTION.repulsion);
        } else {
          ay +=
            (dy < 0 ? -1 : 1) *
            Math.min(MOTION.maximumRepulsion, oy * MOTION.repulsion);
        }
      }
    }
    if (neighbours) {
      ax += (vx / neighbours - a.vx) * MOTION.alignment;
      ay += (vy / neighbours - a.vy) * MOTION.alignment;
    }
    const radial = Math.hypot((a.x - group.x) / group.rx, (a.y - group.y) / group.ry);
    if (radial > MOTION.radialThreshold) {
      ax += (group.x - a.x) * (radial - MOTION.radialThreshold) * MOTION.radialForce;
      ay += (group.y - a.y) * (radial - MOTION.radialThreshold) * MOTION.radialForce;
    }
    ax += Math.cos(state.time * MOTION.horizontalFrequency + a.phase) * MOTION.drift;
    ay += Math.sin(state.time * MOTION.verticalFrequency + a.phase) * MOTION.drift;
    accelerations[index].ax = ax;
    accelerations[index].ay = ay;
  });
  state.nodes.forEach((node, i) => {
    node.vx += accelerations[i].ax * dt;
    node.vy += accelerations[i].ay * dt;
    const speed = Math.hypot(node.vx, node.vy),
      factor =
        speed > MOTION.maximumSpeed
          ? MOTION.maximumSpeed / speed
          : speed < MOTION.minimumSpeed
            ? MOTION.minimumSpeed / (speed || 1)
            : 1;
    node.vx *= factor;
    node.vy *= factor;
    node.x += node.vx * dt;
    node.y += node.vy * dt;
    const pad = Math.hypot(node.w, node.h) / 2 + MOTION.boundaryPadding;
    const x = clamp(node.x, bounds.x + pad, bounds.x + bounds.w - pad),
      y = clamp(node.y, bounds.y + pad, bounds.y + bounds.h - pad);
    if (x !== node.x) {
      node.vx *= MOTION.bounce;
    }
    if (y !== node.y) {
      node.vy *= MOTION.bounce;
    }
    node.x = x;
    node.y = y;
  });
}
