import { createArchiveImport } from "./ui/archive-import.js";
import {
  RELATION_COLORS,
  ITEM_FRAME_STYLE,
  MICROCOSM_PALETTE,
} from "./visual-config.js";
import { createCollagePosterRenderer } from "./rendering/collage-poster.js";
import { prepareCollageSizing } from "./domain/collage-preparation.js";
import { createInspectorController } from "./ui/inspector.js";
import { $, el } from "./ui/dom.js";
import { RenderingHost } from "./rendering/rendering-host.js";
import { Workspace } from "./domain/workspace.js";
import { loadImageAssets } from "./infrastructure/image-assets.js";
import { PosterTemplate } from "./poster-template.js";
import { TraceGraph } from "./graph-layout.js";
import { ConstellationPoster } from "./constellation-poster.js";
import { TraceCollage } from "./collage-layout.js";
import { TraceTransform } from "./collage-transform.js";
import { Microcosm } from "./microcosm-model.js";
import { createCollageInteraction } from "./collage-interaction.js";

/* rendering-host.js */
/** Rendering strategy boundary shared by the native viewer and p5 studio. */

const renderingHost = new RenderingHost(
  (canvas) => canvas === field || canvas === poster,
);

/* workspace-state.js */
/* workspace state */

("use strict");

const workspace = new Workspace();

let showLabels = true,
  images = new Map(),
  nodes = [],
  graphEdges = [],
  graphLabels = [],
  scale = 1,
  pan = { x: 0, y: 0 };

let pointer = null,
  originalURL = null,
  packing = false;

const posterFontsReady = Promise.all([
  document.fonts.load("700 22px Basteleur"),
  document.fonts.load("14px Junction"),
]);

const itemFrameStyle = { ...ITEM_FRAME_STYLE };

const field = $("field"),
  poster = $("poster"),
  graph = field.getContext("2d");

const colors = { ...RELATION_COLORS };

const typeName = (t) =>
  ({
    object: "Object cutout",
    image_fragment: "Image fragment",
    text_fragment: "Text fragment",
  })[t] || t.replaceAll("_", " ");

/* dom-controls.js */
/* dom controls */

function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).classList.toggle("error", error);
}

function inputLabel(parent, title, input) {
  const label = el("label", title);

  label.append(input);
  parent.append(label);
  return label;
}

function action(parent, title, callback, secondary = true) {
  const b = el("button", title, secondary ? "secondary" : "");

  b.onclick = callback;
  parent.append(b);
  return b;
}

/* text-placement.js */
/** Convert Canvas baseline conventions to a baseline coordinate usable by p5.text. */
function baselineOffset(context, font, text, baseline) {
  context.save();
  context.font = font;
  context.textBaseline = baseline;

  const sourceAscent = context.measureText(text).actualBoundingBoxAscent;

  context.textBaseline = "alphabetic";
  const alphabeticAscent = context.measureText(text).actualBoundingBoxAscent;

  context.restore();

  return alphabeticAscent - sourceAscent;
}

/* archive-session.js */
/* archive session */

async function load(data) {
  const loaded = await workspace.open(data, {
    loadAssets: loadImageAssets,
    prepareSizing: (value) =>
      prepareCollageSizing(value.data, value.assets, {
        pack: TraceCollage.pack,
        onStatus: (text) => message("importStatus", text),
      }),
  });
  if (!loaded) {
    return;
  }
  data = workspace.archive;
  stopMicrocosmFrames();
  document.body.classList.add("archive-open");
  images = loaded.assets;
  buildRelationFilters(true);
  collageInteraction.reset();
  $("itemBounds").checked = !!data.participant.collageShowBounds;
  $("posterDarkMode").checked = data.participant.collageTheme === "dark";
  $("empty").classList.add("hidden");
  $("printCurrent").disabled = false;
  $("export").disabled = false;
  const count = collageObjects().length;

  updateDatasetSummary();
  $("collageTab").disabled = !count;
  $("microcosmTab").disabled = false;
  updateSourceList();
  fitGraph();
  setMode(
    workspace.mode === "microcosm"
      ? "microcosm"
      : workspace.mode === "collage" && count
        ? "collage"
        : "constellation",
  );
}

/* relation-filters.js */
/* relation filters */

const relationLabel = (relation) => workspace.relationLabel(relation);

const relationKey = (relation) => workspace.relationKey(relation);

function buildRelationFilters(reset = false) {
  const groups = workspace.relationGroups(reset);
  $("relationChoices").replaceChildren();
  for (const [key, group] of groups) {
    const label = el("label", undefined, "relation-choice"),
      input = el("input"),
      name = el("span", group.label, "relation-name");

    input.type = "checkbox";
    input.value = key;
    input.checked = workspace.enabledRelationLabels.has(key);
    input.setAttribute("aria-label", group.label);
    label.style.setProperty("--relation-color", colors[group.type]);
    label.dataset.relationType = group.type;
    label.title = group.label;
    input.onchange = () => {
      if (input.checked) {
        workspace.setRelationEnabled(key, true);
      } else {
        workspace.setRelationEnabled(key, false);
      }
      renderGraph();
    };
    label.append(input, name);
    $("relationChoices").append(label);
  }
}

const visibleRelations = () => workspace.visibleRelations();

/* view-navigation.js */
/* view navigation */

function updateSourceList() {
  $("sourceList").replaceChildren(
    el(
      "option",
      workspace.mode === "collage" ? "Choose a fragment" : "Choose a screenshot",
    ),
  );
  $("sourceList").firstChild.value = "";
  $("selectionLabel").firstChild.textContent =
    workspace.mode === "collage" ? "Find a fragment" : "Find a trace";
  if (!workspace.archive) {
    return;
  }
  const list =
    workspace.mode === "collage" ? collageObjects() : workspace.archive.items;

  for (const item of list) {
    const label =
      workspace.mode === "collage"
        ? workspace.archive.participant.collage[item.id]?.label || item.label
        : workspace.archive.observations.find((o) => o.id === item.id)?.title ||
          item.filename;
    const o = el("option", label);

    o.value = item.id;
    $("sourceList").append(o);
  }
}

function setMode(next) {
  if (next === "collage" && !workspace.archive?.objects?.length) {
    return;
  }
  if (workspace.mode === "microcosm") {
    saveMicrocosmSnapshot();
    stopMicrocosmFrames();
  }
  workspace.show(next);
  workspace.select(null);
  $("constellationTab").setAttribute("aria-pressed", next === "constellation");
  $("collageTab").setAttribute("aria-pressed", next === "collage");
  $("microcosmTab").setAttribute("aria-pressed", next === "microcosm");
  $("microcosmTools").classList.toggle("hidden", next !== "microcosm");
  $("graphTools").classList.toggle("hidden", next !== "constellation");
  $("collageTools").classList.toggle("hidden", next !== "collage");
  $("relationFilters").classList.toggle("hidden", next !== "constellation");
  field.classList.toggle("hidden", next === "collage");
  poster.classList.toggle("hidden", next !== "collage");
  $("stage").classList.toggle("paper-stage", next === "collage");
  configureGraphFormat();
  $("viewNote").textContent =
    next === "collage"
      ? "A draft weighted by recurring content"
      : next === "microcosm"
        ? "Themes from image + content"
        : "Connections proposed from content";
  $("export").textContent =
    next === "collage" || next === "microcosm" || isConstellationPoster()
      ? "Export A4 PNG"
      : "Export image";
  updateSourceList();
  inspect(null);
  render();
}

/* graph-view.js */
/* graph view */

function graphSize() {
  return { w: field.clientWidth || 600, h: field.clientHeight || 600 };
}

function fitGraph() {
  if (workspace.mode === "microcosm") {
    microcosmCamera = { zoom: 1, x: 0, y: 0 };
    renderMicrocosm();
    return;
  }
  if (isConstellationPoster()) {
    resetConstellationCamera();
    if (workspace.archive) {
      renderConstellationPoster();
    }
    return;
  }
  field.style.width = "";
  field.style.height = "";
  if (!workspace.archive) {
    return;
  }
  const { w, h } = graphSize();
  const projection =
    workspace.archive.projections[$("layout").value] ||
    workspace.archive.projections.fused_pca;
  const coords = projection?.coordinates || {};
  let list = workspace.archive.items.map((i, n) => ({
    id: i.id,
    v: coords[i.id] || [
      Math.cos(n * 2.399) * Math.sqrt(n + 1),
      Math.sin(n * 2.399) * Math.sqrt(n + 1),
    ],
  }));

  if (
    Math.max(...list.map((n) => n.v[0])) - Math.min(...list.map((n) => n.v[0])) <
    1e-8
  ) {
    list = list.map((n, k) => ({
      ...n,
      v: [
        Math.cos(k * 2.399) * Math.sqrt(k + 1),
        Math.sin(k * 2.399) * Math.sqrt(k + 1),
      ],
    }));
  }
  const xs = list.map((n) => n.v[0]),
    ys = list.map((n) => n.v[1]),
    minX = Math.min(...xs),
    minY = Math.min(...ys),
    dx = Math.max(...xs) - minX || 1,
    dy = Math.max(...ys) - minY || 1;
  const spacing = Number($("graphSpacing").value),
    worldW = Math.max(1000, w) * spacing,
    worldH = Math.max(800, h) * spacing;

  nodes = TraceGraph.spreadNodes(
    list.map((n) => {
      const im = images.get(n.id);

      return {
        id: n.id,
        x: ((n.v[0] - minX) / dx) * worldW,
        y: ((n.v[1] - minY) / dy) * worldH,
        w: Math.min(90, (88 * im.width) / im.height),
        h: 88,
      };
    }),
    48 * spacing,
  );
  fitCamera();
}

function fitCamera(overview = false) {
  if (isConstellationPoster()) {
    resetConstellationCamera();
    renderGraph();
    return;
  }
  if (!nodes.length) {
    return;
  }
  const { w, h } = graphSize(),
    left = Math.min(...nodes.map((n) => n.x - n.w / 2)),
    right = Math.max(...nodes.map((n) => n.x + n.w / 2)),
    top = Math.min(...nodes.map((n) => n.y - n.h / 2)),
    bottom = Math.max(...nodes.map((n) => n.y + n.h / 2));

  scale = Math.min(
    1,
    Math.max(1, w - 56) / (right - left),
    Math.max(1, h - 56) / (bottom - top),
  );
  if (!overview && w < 500) {
    scale = Math.max(0.5, scale);
  }
  pan = {
    x: w / 2 - ((left + right) / 2) * scale,
    y: h / 2 - ((top + bottom) / 2) * scale,
  };
  renderGraph();
}

function renderGraph() {
  if (workspace.mode === "microcosm") {
    return renderMicrocosm();
  }
  if (isConstellationPoster()) {
    renderConstellationPoster();
    return;
  }
  return renderingHost.paint("constellation", graph, true, paintGraph, "explore");
}

function paintGraph() {
  const { w, h } = graphSize(),
    ratio = devicePixelRatio || 1;

  if (field.width !== Math.round(w * ratio) || field.height !== Math.round(h * ratio)) {
    field.width = Math.round(w * ratio);
    field.height = Math.round(h * ratio);
  }
  graph.setTransform(ratio, 0, 0, ratio, 0, 0);
  graph.fillStyle = "#090909";
  graph.fillRect(0, 0, w, h);
  if (!workspace.archive) {
    return;
  }
  const screenNodes = nodes.map((n) => ({
      ...n,
      x: n.x * scale + pan.x,
      y: n.y * scale + pan.y,
      w: n.w * scale,
      h: n.h * scale,
    })),
    map = new Map(screenNodes.map((n) => [n.id, n])),
    relations = visibleRelations(),
    pairs = new Map();

  for (const r of relations) {
    const key = [r.source, r.target].sort().join("|");

    if (!pairs.has(key)) {
      pairs.set(key, []);
    }
    pairs.get(key).push(r);
  }
  graphEdges = [];
  graphLabels = [];
  for (const group of pairs.values()) {
    for (const [index, r] of group.entries()) {
      // Canonical endpoint order keeps parallel lanes separate for reversed links too.
      const [first, last] = [r.source, r.target].sort(),
        segment = TraceGraph.edgeSegment(
          map.get(first),
          map.get(last),
          (index - (group.length - 1) / 2) * 11,
        );

      if (!segment) {
        continue;
      }
      const active =
        !workspace.selected ||
        workspace.selected.id === r.id ||
        workspace.selected.id === r.source ||
        workspace.selected.id === r.target;

      graphEdges.push({ ...segment, relation: r, active });
      graph.globalAlpha = active ? 0.9 : 0.45;
      graph.strokeStyle = colors[r.type];
      graph.lineWidth = workspace.selected?.id === r.id ? 5 : 2.4;
      graph.setLineDash(
        r.type === "transformation" ? [6, 3] : r.type === "continuation" ? [2, 3] : [],
      );
      renderingHost.element(
        "relation",
        graph,
        {
          id: r.id,
          points: [
            { x: segment.x1, y: segment.y1 },
            { x: segment.x2, y: segment.y2 },
          ],
          color: colors[r.type],
          width: graph.lineWidth,
          opacity: graph.globalAlpha,
          dash: graph.getLineDash(),
        },
        () => {
          graph.beginPath();
          graph.moveTo(segment.x1, segment.y1);
          graph.lineTo(segment.x2, segment.y2);
          graph.stroke();
        },
      );
    }
  }
  graph.setLineDash([]);
  graph.globalAlpha = 1;
  for (const n of screenNodes) {
    renderingHost.element(
      "screenshot",
      graph,
      {
        id: n.id,
        image: images.get(n.id),
        x: n.x - n.w / 2,
        y: n.y - n.h / 2,
        width: n.w,
        height: n.h,
      },
      () => graph.drawImage(images.get(n.id), n.x - n.w / 2, n.y - n.h / 2, n.w, n.h),
    );
    if (workspace.selected?.id === n.id) {
      graph.strokeStyle = "#d4ed70";
      graph.lineWidth = 2;
      graph.strokeRect(n.x - n.w / 2 - 4, n.y - n.h / 2 - 4, n.w + 8, n.h + 8);
    }
  }
  const obstacles = screenNodes.map((n) =>
    TraceGraph.rectPolygon({
      x: n.x - n.w / 2 - 5,
      y: n.y - n.h / 2 - 5,
      w: n.w + 10,
      h: n.h + 10,
    }),
  );

  graph.font = "12px Junction,Arial";
  const priority = (e) =>
    workspace.selected?.id === e.relation.id ? 4 : e.active ? 2 : 0;

  for (const edge of [...graphEdges].sort(
    (a, b) =>
      priority(b) - priority(a) ||
      Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1),
  )) {
    const r = edge.relation;

    if (!showLabels && workspace.selected?.id !== r.id) {
      continue;
    }
    const full = workspace.archive.participant.relations[r.id]?.label || r.label,
      maxWidth = Math.min(182, Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1) - 18);
    let text = TraceGraph.shortLabel(full),
      limit = 28;

    while (graph.measureText(text).width > maxWidth && limit > 5) {
      text = TraceGraph.shortLabel(full, --limit);
    }
    if (graph.measureText(text).width > maxWidth) {
      continue;
    }
    const box = TraceGraph.findLabel(
      edge,
      graph.measureText(text).width,
      12,
      obstacles,
      { w, h },
    );

    if (!box) {
      continue;
    }
    obstacles.push(box.corners);
    graphLabels.push({ ...box, text, relation: r });
    const labelModel = {
      id: r.id,
      x: box.x,
      y: box.y,
      angle: box.angle,
      font: "Junction",
      size: 12,
      color: colors[r.type],
      opacity: edge.active ? 1 : 0.65,
      background: {
        x: -box.width / 2 - 4,
        y: -20,
        width: box.width + 8,
        height: 16,
        color: "#090909",
        opacity: 0.92,
      },
      rows: [
        {
          text,
          y: -5 + baselineOffset(graph, "12px Junction,Arial", text, "bottom"),
        },
      ],
    };

    renderingHost.element("label", graph, labelModel, () => {
      graph.save();
      graph.translate(box.x, box.y);
      graph.rotate(box.angle);
      graph.globalAlpha = 0.92;
      graph.fillStyle = "#090909";
      graph.fillRect(-box.width / 2 - 4, -20, box.width + 8, 16);
      graph.globalAlpha = edge.active ? 1 : 0.65;
      graph.fillStyle = colors[r.type];
      graph.textAlign = "center";
      graph.textBaseline = "bottom";
      graph.fillText(text, 0, -5);
      graph.restore();
    });
  }
  graph.globalAlpha = 1;
  graph.textAlign = "left";
  graph.textBaseline = "alphabetic";
  $("count").textContent =
    `${relations.length} / ${workspace.archive.relations.length} connections · ${graphLabels.length} labels`;
}

/* collage-model.js */
/* collage model */

const baseBoxes = () => workspace.baseBoxes();

const collageObjects = () => workspace.collageObjects();

const placement = (obj) => workspace.placement(obj);

const posterContentBounds = () => workspace.posterContentBounds();

function posterMmPerPixel() {
  return 210 / (poster.getBoundingClientRect().width || 577);
}

function editObject(obj, changes) {
  const placement = workspace.editObject(obj, changes);
  renderPoster();
  return placement;
}

/* poster-assets.js */
/* poster assets */

function posterPalette() {
  return workspace.archive?.participant.collageTheme === "dark"
    ? {
        background: "#000000",
        text: "#ffffff",
        outline: "#ffffff",
        cornerFill: "#000000",
      }
    : {
        background: "#ffffff",
        text: "#000000",
        outline: itemFrameStyle.color,
        cornerFill: "#ffffff",
      };
}

function posterImage(obj) {
  const light = images.get("poster:" + obj.id) || images.get(obj.id);

  if (workspace.archive.participant.collageTheme !== "dark" || !obj.posterAsset) {
    return light;
  }
  const key = "poster-dark:" + obj.id;

  if (images.has(key)) {
    return images.get(key);
  }
  const raw = images.get(obj.id),
    c = document.createElement("canvas");

  c.width = light.naturalWidth;
  c.height = light.naturalHeight;
  const ctx = c.getContext("2d");

  ctx.drawImage(light, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-over";
  let box = obj.posterContentBox;

  if (!box) {
    const n = Math.min(raw.naturalWidth, raw.naturalHeight) * 0.1,
      f = Math.floor(n),
      rounded = Math.abs(n - f - 0.5) < 1e-8 ? (f % 2 ? f + 1 : f) : Math.round(n),
      pad = Math.max(10, rounded),
      w = raw.naturalWidth + 2 * pad,
      h = raw.naturalHeight + 2 * pad;

    box = [pad / w, pad / h, raw.naturalWidth / w, raw.naturalHeight / h];
  }
  const [x, y, w, h] = box;

  ctx.drawImage(raw, x * c.width, y * c.height, w * c.width, h * c.height);
  images.set(key, c);
  return c;
}

/* collage-renderer.js */
/* collage renderer */

function drawItemFrame(context, p, editing = false) {
  const palette = posterPalette(),
    c = TraceTransform.center(p),
    size = itemFrameStyle.cornerSizeMm;

  context.save();
  context.translate(c.x, c.y);
  context.rotate((p.rotation * Math.PI) / 180);
  context.strokeStyle = palette.outline;
  context.lineWidth = itemFrameStyle.lineWidthMm;
  context.strokeRect(-p.widthMm / 2, -p.heightMm / 2, p.widthMm, p.heightMm);
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const x = (sx * p.widthMm) / 2 - size / 2,
      y = (sy * p.heightMm) / 2 - size / 2;

    context.fillStyle = editing ? palette.outline : palette.cornerFill;
    context.fillRect(x, y, size, size);
    context.strokeStyle = palette.outline;
    context.lineWidth = 0.25;
    context.strokeRect(x, y, size, size);
  }
  context.restore();
  if (editing) {
    const h = TraceTransform.controls(p, posterMmPerPixel());

    context.save();
    context.strokeStyle = palette.outline;
    context.lineWidth = itemFrameStyle.lineWidthMm;
    context.beginPath();
    context.moveTo(h.stem.x, h.stem.y);
    context.lineTo(h.rotation.x, h.rotation.y);
    context.stroke();
    context.beginPath();
    context.arc(
      h.rotation.x,
      h.rotation.y,
      Math.max(1.2, 4 * posterMmPerPixel()),
      0,
      Math.PI * 2,
    );
    context.fillStyle = palette.outline;
    context.fill();
    context.strokeStyle = "#111";
    context.lineWidth = 0.15;
    context.stroke();
    context.restore();
  }
}

const collagePosterRenderer = createCollagePosterRenderer({
  workspace,
  collageObjects,
  posterPalette,
  PosterTemplate,
  posterContentBounds,
  placement,
  posterImage,
  renderingHost,
  drawItemFrame,
});

function renderPoster(context = poster.getContext("2d"), interactive = true) {
  return renderingHost.paint("collage", context, interactive, () => {
    const count = collagePosterRenderer.render(context, interactive);
    if (interactive && count !== undefined) {
      $("count").textContent =
        `${count} / ${collageObjects().length} fragments · A4 portrait`;
    }
  });
}

/* inspector.js */
/** Selection inspector: only responsible for building the selected item panel. */
const InspectorController = createInspectorController({
  workspace,
  el,
  showMicrocosmTheme,
  showMicrocosmOverview,
  editObject,
  action,
  viewSource,
  typeName,
  colors,
  buildRelationFilters,
  renderGraph,
  inputLabel,
  inspect,
  addMicrocosmSourceContext,
});

const inspectorController = new InspectorController($("inspector"));

function inspect(value) {
  inspectorController.show(value);
}

/* source-dialog.js */
/* source dialog */

async function viewSource(id, bbox = null) {
  const source = workspace.archive.items.find((i) => i.id === id);

  $("sourceTitle").textContent = workspace.archive.observations.find(
    (o) => o.id === id,
  ).title;
  $("sourceCaption").textContent = source.filename;
  $("sourceError").classList.add("hidden");
  $("locateLabel").classList.add("hidden");
  $("originalBox").classList.toggle("hidden", !bbox);
  if (bbox) {
    const r = $("cropRect");

    ["x", "y", "width", "height"].forEach((k, n) => r.setAttribute(k, bbox[n] * 1000));
  }
  if (originalURL) {
    URL.revokeObjectURL(originalURL);
    originalURL = null;
  }
  const im = $("originalImage");

  im.onerror = () => {
    $("sourceError").classList.remove("hidden");
    $("locateLabel").classList.remove("hidden");
  };
  if (!$("sourceDialog").open) {
    $("sourceDialog").showModal();
  }
  try {
    if (/^data:image\/png;base64,/.test(source.originalAsset || "")) {
      im.src = source.originalAsset;
    } else if (
      source.originalPath &&
      !source.originalPath.includes("..") &&
      !source.originalPath.startsWith("/")
    ) {
      im.src = source.originalPath;
    } else {
      throw Error("Original not in this JSON.");
    }
  } catch {
    im.removeAttribute("src");
    $("sourceError").classList.remove("hidden");
    $("locateLabel").classList.remove("hidden");
  }
}

$("closeSource").onclick = () => $("sourceDialog").close();

$("locateOriginal").onchange = () => {
  const file = $("locateOriginal").files[0];

  if (!file) {
    return;
  }
  const reader = new FileReader();

  reader.onload = () => {
    $("originalImage").src = reader.result;
    $("sourceError").classList.add("hidden");
  };
  reader.readAsDataURL(file);
};

/* collage-packing.js */
/* collage packing */

async function packAgain(equal = false) {
  if (!workspace.archive?.objects || packing) {
    return;
  }
  const dataset = workspace.archive,
    visible = collageObjects().filter(
      (o) => !workspace.archive.participant.collage[o.id]?.hidden,
    );

  packing = true;
  for (const id of ["arrange", "equal", "resetCollage"]) {
    $(id).disabled = true;
  }
  const button = $(equal ? "equal" : "arrange"),
    caption = button.textContent;

  button.textContent = "Filling the page…";
  try {
    const placed = await TraceCollage.pack(
      visible,
      (o) => images.get("poster:" + o.id) || images.get(o.id),
      { equal },
    );

    if (workspace.archive !== dataset) {
      return;
    }
    workspace.applyCollageLayout(placed, visible, equal);
    inspect(workspace.selected);
    renderPoster();
  } catch (e) {
    message("importStatus", e.message, true);
  } finally {
    packing = false;
    for (const id of ["arrange", "equal", "resetCollage"]) {
      $(id).disabled = false;
    }
    button.textContent = caption;
  }
}

// Upgrade untouched default layouts; participant positions and equal sizing win.

/* graph-interaction.js */
/* graph interaction */

function hitGraph(x, y) {
  if (workspace.mode === "microcosm") {
    return hitMicrocosm(x, y);
  }
  if (isConstellationPoster()) {
    return hitConstellationPoster(x, y);
  }
  for (const n of [...nodes].reverse()) {
    if (
      Math.abs(x - (n.x * scale + pan.x)) < (n.w * scale) / 2 + 5 &&
      Math.abs(y - (n.y * scale + pan.y)) < (n.h * scale) / 2 + 5
    ) {
      return { type: "source", id: n.id };
    }
  }
  const point = TraceGraph.rectPolygon({
    x: x - 0.5,
    y: y - 0.5,
    w: 1,
    h: 1,
  });

  for (const label of graphLabels) {
    if (TraceGraph.polygonsOverlap(point, label.corners)) {
      return { type: "relation", id: label.relation.id };
    }
  }
  for (const edge of [...graphEdges].reverse()) {
    const dx = edge.x2 - edge.x1,
      dy = edge.y2 - edge.y1,
      t = Math.max(
        0,
        Math.min(
          1,
          ((x - edge.x1) * dx + (y - edge.y1) * dy) / (dx * dx + dy * dy || 1),
        ),
      );

    if (Math.hypot(x - edge.x1 - t * dx, y - edge.y1 - t * dy) < 6) {
      return { type: "relation", id: edge.relation.id };
    }
  }
  return null;
}

field.onpointerdown = (e) => {
  if (!workspace.archive) {
    return;
  }
  const r = field.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top;

  pointer = {
    x,
    y,
    pan: { ...pan },
    camera: { ...constellationCamera },
    microCamera: { ...microcosmCamera },
    moved: false,
    hit: hitGraph(x, y),
  };
  field.setPointerCapture(e.pointerId);
};

field.onpointermove = (e) => {
  if (!pointer || !workspace.archive) {
    return;
  }
  const r = field.getBoundingClientRect(),
    dx = e.clientX - r.left - pointer.x,
    dy = e.clientY - r.top - pointer.y;

  if (Math.hypot(dx, dy) > 4) {
    pointer.moved = true;
  }
  if (pointer.moved) {
    if (workspace.mode === "microcosm") {
      microcosmCamera = {
        ...pointer.microCamera,
        x: pointer.microCamera.x + (dx * 297) / r.width,
        y: pointer.microCamera.y + (dy * 210) / r.height,
      };
    } else if (isConstellationPoster()) {
      constellationCamera = {
        ...pointer.camera,
        x: pointer.camera.x + (dx * 297) / r.width,
        y: pointer.camera.y + (dy * 210) / r.height,
      };
    } else {
      pan = { x: pointer.pan.x + dx, y: pointer.pan.y + dy };
    }
    renderGraph();
  }
};

field.onpointerup = () => {
  if (pointer && !pointer.moved) {
    inspect(pointer.hit);
    renderGraph();
  }
  pointer = null;
};

field.onpointercancel = () => (pointer = null);

function zoomGraph(factor, x = graphSize().w / 2, y = graphSize().h / 2) {
  if (!workspace.archive) {
    return;
  }
  if (workspace.mode === "microcosm") {
    return zoomMicrocosm(factor, x, y);
  }
  if (isConstellationPoster()) {
    return zoomConstellationPoster(factor, x, y);
  }
  const next = Math.min(5, Math.max(0.08, scale * factor));

  pan = {
    x: x - ((x - pan.x) * next) / scale,
    y: y - ((y - pan.y) * next) / scale,
  };
  scale = next;
  renderGraph();
}

field.onwheel = (e) => {
  if (!workspace.archive) {
    return;
  }
  e.preventDefault();
  const r = field.getBoundingClientRect();

  zoomGraph(Math.exp(-e.deltaY * 0.001), e.clientX - r.left, e.clientY - r.top);
};

function hitConstellationPoster(x, y) {
  const r = field.getBoundingClientRect();

  x = ((x / r.width) * 297 - pan.x) / scale;
  y = ((y / r.height) * 210 - pan.y) / scale;
  const point = ConstellationPoster.polygon({
    x: x - 0.1,
    y: y - 0.1,
    w: 0.2,
    h: 0.2,
  });

  for (const label of graphLabels) {
    if (ConstellationPoster.overlaps(point, label.corners)) {
      return { type: "relation", id: label.relation.id };
    }
  }
  for (const n of nodes) {
    if (Math.abs(x - n.x) < n.w / 2 && Math.abs(y - n.y) < n.h / 2) {
      return { type: "source", id: n.id };
    }
  }
  for (const edge of graphEdges) {
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1],
        b = edge.points[i],
        dx = b.x - a.x,
        dy = b.y - a.y,
        t = Math.max(
          0,
          Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)),
        );

      if (Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < 1) {
        return { type: "relation", id: edge.relation.id };
      }
    }
  }
  return null;
}

const collageInteraction = createCollageInteraction({
  canvas: poster,
  getState: () => ({
    archive: workspace.archive,
    selected: workspace.selected,
    packing,
  }),
  getObjects: collageObjects,
  getPlacement: placement,
  getImage: (id) => images.get("poster:" + id) || images.get(id),
  transforms: TraceTransform,
  getContentBounds: posterContentBounds,
  getBaseBoxes: baseBoxes,
  editObject,
  inspect,
  render: renderPoster,
});

/* downloads.js */
/* downloads */

function download(name, value, type = "application/json") {
  const blob =
    value instanceof Blob
      ? value
      : new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], {
          type,
        });
  const url = URL.createObjectURL(blob),
    a = el("a");

  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function pngAt300Dpi(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    parts = [bytes.slice(0, 8)],
    chunk = new Uint8Array(21),
    view = new DataView(chunk.buffer);

  view.setUint32(0, 9);
  chunk.set(new TextEncoder().encode("pHYs"), 4);
  view.setUint32(8, 11811);
  view.setUint32(12, 11811);
  chunk[16] = 1;
  let crc = 0xffffffff;

  for (const byte of chunk.slice(4, 17)) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  for (let offset = 8; offset + 12 <= bytes.length; ) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(
        0,
      ),
      end = offset + length + 12;

    if (end > bytes.length) {
      throw Error("PNG export was incomplete.");
    }
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));

    if (type !== "pHYs") {
      parts.push(bytes.slice(offset, end));
    }
    if (type === "IHDR") {
      parts.push(chunk);
    }
    offset = end;
  }
  return new Blob(parts, { type: "image/png" });
}

async function printConstellationPoster() {
  await document.fonts.ready;
  await posterFontsReady;
  const c = document.createElement("canvas");

  renderConstellationPoster(c.getContext("2d"), false);
  if (constellationPage.unplaced.length) {
    message(
      "importStatus",
      "Some labels do not fit. Choose fewer relations before printing this A4 poster.",
      true,
    );
    return;
  }
  const win = window.open("", "_blank");

  if (!win) {
    message("importStatus", "Allow the print window, or export the A4 PNG.", true);
    return;
  }
  win.document.write(
    "<!doctype html><html><head><title>Constellation · A4 landscape</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;background:#090909}img{display:block;width:297mm;height:210mm}</style></head><body>",
  );
  const im = win.document.createElement("img");

  im.alt = "Screenshot Archaeology constellation poster";
  im.onload = () => {
    win.focus();
    win.print();
  };
  im.src = c.toDataURL("image/png");
  win.document.body.append(im);
  win.document.close();
}

/* constellation-controls.js */
function configureGraphFormat() {
  const paper = workspace.mode === "constellation" && isConstellationPoster(),
    filters = $("relationFilters"),
    stage = $("stage");

  if (paper) {
    stage.append(filters);
  } else {
    $("graphTools").before(filters);
  }
  filters.classList.toggle("poster-relation-filters", paper);
  stage.classList.toggle(
    "constellation-stage",
    paper || workspace.mode === "microcosm",
  );
  if (!paper) {
    filters.removeAttribute("style");
    $("relationChoices").style.gridTemplateColumns = "";
    for (const label of $("relationChoices").children) {
      label.style.fontSize = "";
    }
  }
  for (const id of ["layout", "graphSpacing"]) {
    $(id).closest("label").classList.toggle("hidden", paper);
  }
  for (const id of ["labels"]) {
    $(id).classList.toggle("hidden", paper);
  }
  $("resetGraph").classList.remove("hidden");
}

/* constellation-model.js */
/* The same millimetre-based composition is used on screen, in PNGs and for print. */
let constellationPage = null,
  constellationCacheKey = "",
  constellationBasePage = null,
  constellationBaseKey = "";
const isConstellationPoster = () => true;

function prepareConstellationPoster() {
  const relations = workspace.archive.relations
    .filter((r) => workspace.archive.participant.relations[r.id]?.status !== "rejected")
    .map((r) => ({ ...r, label: relationLabel(r) }));
  const groups = new Map();

  for (const r of workspace.archive.relations) {
    if (!groups.has(relationKey(r))) {
      groups.set(relationKey(r), {
        key: relationKey(r),
        label: relationLabel(r),
        type: r.type,
      });
    }
  }
  const baseKey = JSON.stringify([
    workspace.archive.datasetId,
    relations.map((r) => [r.id, r.label, r.type]),
    [...groups.keys()],
    document.fonts.check("14px Junction"),
    renderingHost.layoutOptions.thumbnailScale,
  ]);
  const measure = (t, size) => {
    graph.font = `${size}px Junction,Arial`;
    return graph.measureText(t).width;
  };

  if (baseKey !== constellationBaseKey) {
    const legend = ConstellationPoster.legend([...groups.values()], measure);

    constellationBasePage = {
      ...ConstellationPoster.layout(
        workspace.archive.items,
        relations,
        workspace.archive.projections.fused_umap?.coordinates || {},
        measure,
        legend.y + legend.h,
        renderingHost.layoutOptions,
      ),
      legend,
    };
    constellationBaseKey = baseKey;
  }
  const key =
    baseKey +
    (constellationBasePage.unplaced.length
      ? JSON.stringify([...workspace.enabledRelationLabels])
      : "");

  if (key === constellationCacheKey && constellationPage) {
    return constellationPage;
  }
  const legend = constellationBasePage.legend;

  constellationPage = constellationBasePage.unplaced.length
    ? {
        ...ConstellationPoster.layout(
          workspace.archive.items,
          relations.filter((r) => workspace.enabledRelationLabels.has(relationKey(r))),
          workspace.archive.projections.fused_umap?.coordinates || {},
          measure,
          legend.y + legend.h,
          renderingHost.layoutOptions,
        ),
        legend,
      }
    : constellationBasePage;
  constellationCacheKey = key;
  return constellationPage;
}

// Inspection camera only. The archive and print composition stay in millimetres.
let constellationCamera = { zoom: 1, x: 0, y: 0 };
function resetConstellationCamera() {
  constellationCamera = { zoom: 1, x: 0, y: 0 };
}
function zoomConstellationPoster(factor, x, y) {
  const page = prepareConstellationPoster(),
    r = field.getBoundingClientRect();
  const ax = (x * 297) / r.width,
    ay = (y * 210) / r.height;
  const cx = page.bounds.x + page.bounds.w / 2,
    cy = page.bounds.y + page.bounds.h / 2;
  const next = Math.min(6, Math.max(0.25, constellationCamera.zoom * factor));
  const ratio = next / constellationCamera.zoom;
  constellationCamera = {
    zoom: next,
    x: ax - cx - (ax - cx - constellationCamera.x) * ratio,
    y: ay - cy - (ay - cy - constellationCamera.y) * ratio,
  };
  renderGraph();
}

/* constellation-view.js */
function renderConstellationPoster(context = graph, interactive = true) {
  return renderingHost.paint("constellation", context, interactive, () =>
    paintConstellationPoster(context, interactive),
  );
}

function paintConstellationPoster(context, interactive) {
  prepareConstellationSurface(context, interactive);
  if (!workspace.archive) {
    return;
  }

  const page = prepareConstellationPoster();
  const visible = new Set(visibleRelations().map((relation) => relation.id));

  drawConstellationTitle(context);
  drawConstellationLegend(context, page);
  context.save();
  const { bounds } = page;
  context.beginPath();
  context.rect(bounds.x, bounds.y, bounds.w, bounds.h);
  context.clip();
  if (interactive) {
    const cx = bounds.x + bounds.w / 2,
      cy = bounds.y + bounds.h / 2;
    context.translate(cx + constellationCamera.x, cy + constellationCamera.y);
    context.scale(constellationCamera.zoom, constellationCamera.zoom);
    context.translate(-cx, -cy);
  }
  drawConstellationRelations(context, page, visible, interactive);
  drawConstellationLeaders(context, page, visible, interactive);
  drawConstellationScreenshots(context, page, interactive);
  const drawn = drawConstellationLabels(context, page, visible, interactive);
  context.restore();
  drawConstellationFooter(context);

  if (interactive) {
    updateConstellationInteraction(page, drawn, visible);
  }
}

function prepareConstellationSurface(context, interactive) {
  const canvas = context.canvas,
    ratio = devicePixelRatio || 1;

  if (interactive) {
    const stage = $("stage"),
      w = Math.max(220, stage.clientWidth - 44),
      h = Math.max(156, stage.clientHeight - 44),
      f = Math.min(w / 297, h / 210);

    field.style.width = `${297 * f}px`;
    field.style.height = `${210 * f}px`;
    field.width = Math.round(297 * f * ratio);
    field.height = Math.round(210 * f * ratio);
  } else {
    canvas.width = 3508;
    canvas.height = 2480;
  }
  context.setTransform(canvas.width / 297, 0, 0, canvas.height / 210, 0, 0);
  context.globalAlpha = 1;
  context.fillStyle = "#090909";
  context.fillRect(0, 0, 297, 210);
}

function drawConstellationTitle(context) {
  context.fillStyle = "#fff";
  context.font = "700 10px Basteleur,serif";
  context.letterSpacing = "-.4px";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(
    workspace.archive.participant.constellationTitle ?? "Screenshot Archeology",
    8,
    16,
  );
  context.letterSpacing = "0px";
}

function drawConstellationLegend(context, page) {
  for (const [index, cell] of page.legend.cells.entries()) {
    const nextCell = page.legend.cells[index + 1];
    const lastInRow = !nextCell || nextCell.y !== cell.y;
    context.fillStyle = "#fff";
    context.fillRect(cell.x, cell.y, cell.w, cell.h);
    const on = workspace.enabledRelationLabels.has(cell.key);

    context.fillStyle = on ? colors[cell.type] : "#191919";
    context.fillRect(
      cell.x + 0.18,
      cell.y + 0.18,
      cell.w - 0.18 - (lastInRow ? 0.18 : 0),
      cell.h -
        0.18 -
        (cell.y + cell.h >= page.legend.y + page.legend.h - 0.01 ? 0.18 : 0),
    );
    context.fillStyle = on ? "#090909" : colors[cell.type];
    context.font = `${cell.size}px Junction,Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    cell.lines.forEach((line, i) =>
      context.fillText(
        line,
        cell.x + cell.w / 2,
        cell.y + cell.h / 2 + (i - (cell.lines.length - 1) / 2) * cell.size * 1.15,
      ),
    );
  }
}

/** Selection is an inspection effect; exported relations keep their original opacity. */
function relationOpacity(selection, relationId, interactive) {
  const isOtherRelation = selection?.type === "relation" && selection.id !== relationId;
  return interactive && isOtherRelation ? 0.15 : 1;
}

function drawConstellationRelations(context, page, visible, interactive) {
  for (const edge of page.edges) {
    if (!visible.has(edge.relation.id)) {
      continue;
    }
    context.save();
    const opacity = relationOpacity(workspace.selected, edge.relation.id, interactive);
    context.globalAlpha = opacity;
    context.strokeStyle = colors[edge.relation.type];
    context.lineWidth = 0.55;
    renderingHost.element(
      "relation",
      context,
      {
        id: edge.relation.id,
        points: edge.points,
        color: colors[edge.relation.type],
        width: 0.55,
        opacity,
        dash: [],
      },
      () => {
        context.beginPath();
        edge.points.forEach((p, i) =>
          i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y),
        );
        context.stroke();
      },
    );
    context.restore();
  }
}

function drawConstellationLeaders(context, page, visible, interactive) {
  for (const box of page.labels) {
    if (!visible.has(box.relation.id) || !box.leader) {
      continue;
    }
    context.save();
    const opacity = relationOpacity(workspace.selected, box.relation.id, interactive);
    context.globalAlpha = opacity;
    context.strokeStyle = colors[box.relation.type];
    context.lineWidth = 0.15;
    context.setLineDash([0.5, 0.6]);
    renderingHost.element(
      "relation",
      context,
      {
        id: box.relation.id,
        points: [box.leader, { x: box.x, y: box.y }],
        color: colors[box.relation.type],
        width: 0.15,
        opacity,
        dash: [0.5, 0.6],
        leader: true,
      },
      () => {
        context.beginPath();
        context.moveTo(box.leader.x, box.leader.y);
        context.lineTo(box.x, box.y);
        context.stroke();
      },
    );
    context.setLineDash([]);
    context.restore();
  }
}

function drawConstellationScreenshots(context, page, interactive) {
  const relation =
    interactive && workspace.selected?.type === "relation"
      ? workspace.archive.relations.find((r) => r.id === workspace.selected.id)
      : null;
  const highlighted = new Set(relation ? [relation.source, relation.target] : []);
  for (const n of page.nodes) {
    context.save();
    context.globalAlpha = relation && !highlighted.has(n.id) ? 0.2 : 1;
    renderingHost.element(
      "screenshot",
      context,
      {
        id: n.id,
        image: images.get(n.id),
        x: n.x - n.w / 2,
        y: n.y - n.h / 2,
        width: n.w,
        height: n.h,
      },
      () => context.drawImage(images.get(n.id), n.x - n.w / 2, n.y - n.h / 2, n.w, n.h),
    );
    if (interactive && (workspace.selected?.id === n.id || highlighted.has(n.id))) {
      context.strokeStyle = "#fff";
      context.globalAlpha = 1;
      context.lineWidth = 0.55;
      context.strokeRect(
        n.x - n.w / 2 - 0.3,
        n.y - n.h / 2 - 0.3,
        n.w + 0.6,
        n.h + 0.6,
      );
    }
    context.restore();
  }
}

function drawConstellationLabels(context, page, visible, interactive) {
  const drawn = [];

  for (const box of page.labels) {
    if (!visible.has(box.relation.id)) {
      continue;
    }
    const opacity = relationOpacity(workspace.selected, box.relation.id, interactive);
    const labelModel = {
      id: box.relation.id,
      x: box.x,
      y: box.y,
      angle: box.angle,
      font: "Junction",
      size: box.size,
      color: colors[box.relation.type],
      opacity,
      background: {
        x: -box.w / 2,
        y: -box.h - 0.8,
        width: box.w,
        height: box.h,
        color: "#090909",
        opacity: 1,
      },
      rows: box.lines.map((text, i) => ({
        text,
        y:
          -box.h +
          i * box.size * 1.18 +
          baselineOffset(context, `${box.size}px Junction,Arial`, text, "top"),
      })),
    };

    renderingHost.element("label", context, labelModel, () => {
      context.save();
      context.translate(box.x, box.y);
      context.rotate(box.angle);
      context.fillStyle = "#090909";
      context.fillRect(-box.w / 2, -box.h - 0.8, box.w, box.h);
      context.globalAlpha = opacity;
      context.fillStyle = colors[box.relation.type];
      context.font = `${box.size}px Junction,Arial`;
      context.textAlign = "center";
      context.textBaseline = "top";
      box.lines.forEach((line, i) =>
        context.fillText(line, 0, -box.h + i * box.size * 1.18),
      );
      context.restore();
    });
    drawn.push(box);
  }

  return drawn;
}

function drawConstellationFooter(context) {
  context.save();
  context.globalAlpha = 0.5;
  context.font = "3px Junction,Arial";
  context.fillStyle = "#fff";
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  context.fillText(
    workspace.archive.participant.collageFooterLeft ??
      workspace.archive.collage?.footerLeft ??
      "",
    8,
    204,
  );
  context.textAlign = "right";
  context.fillText(
    workspace.archive.participant.collageFooterRight ??
      workspace.archive.collage?.footerRight ??
      "",
    289,
    204,
  );
  context.textAlign = "left";
  context.restore();
}

function updateConstellationInteraction(page, drawn, visible) {
  nodes = page.nodes;
  scale = constellationCamera.zoom;
  pan = {
    x: constellationCamera.x + (1 - scale) * (page.bounds.x + page.bounds.w / 2),
    y: constellationCamera.y + (1 - scale) * (page.bounds.y + page.bounds.h / 2),
  };
  graphLabels = drawn;
  graphEdges = page.edges.filter((e) => visible.has(e.relation.id));
  const r = field.getBoundingClientRect(),
    stage = $("stage").getBoundingClientRect(),
    f = r.width / 297,
    filters = $("relationFilters");

  Object.assign(filters.style, {
    left: `${r.left - stage.left + page.legend.x * f}px`,
    top: `${r.top - stage.top + page.legend.y * f}px`,
    width: `${page.legend.w * f}px`,
    height: `${page.legend.h * f}px`,
  });
  $("relationChoices").style.gridTemplateColumns =
    `repeat(${page.legend.columns},minmax(0,1fr))`;
  [...$("relationChoices").children].forEach((label, i) => {
    label.style.fontSize = `${page.legend.cells[i].size * f}px`;
  });
  $("count").textContent = page.unplaced.length
    ? `${page.unplaced.length} labels need more space. Choose fewer relations for a legible A4 poster.`
    : ``;
  $("count").classList.toggle("error", page.unplaced.length > 0);
}

/* ui-actions.js */
/* ui actions */

$("constellationTab").onclick = () => setMode("constellation");

$("collageTab").onclick = () => setMode("collage");

$("sourceList").onchange = (e) => {
  inspect(
    e.target.value
      ? { type: workspace.mode === "collage" ? "object" : "source", id: e.target.value }
      : null,
  );
  render();
};

$("layout").onchange = fitGraph;

$("graphSpacing").oninput = fitGraph;

$("resetGraph").onclick = () => fitCamera(true);

for (const [id, checked] of [
  ["allRelations", true],
  ["noRelations", false],
]) {
  $(id).onclick = () => {
    for (const input of $("relationChoices").querySelectorAll("input")) {
      input.checked = checked;
      if (checked) {
        workspace.setRelationEnabled(input.value, true);
      } else {
        workspace.setRelationEnabled(input.value, false);
      }
    }
    renderGraph();
  };
}

$("labels").onclick = () => {
  showLabels = !showLabels;
  $("labels").setAttribute("aria-pressed", showLabels);
  $("labels").textContent = showLabels ? "Hide labels" : "Show labels";
  renderGraph();
};

$("posterDarkMode").onchange = () => {
  if (workspace.archive) {
    workspace.updateParticipant({
      collageTheme: $("posterDarkMode").checked ? "dark" : "light",
    });
    renderPoster();
  }
};

$("itemBounds").onchange = () => {
  if (workspace.archive) {
    workspace.updateParticipant({ collageShowBounds: $("itemBounds").checked });
    renderPoster();
  }
};

$("arrange").onclick = () => packAgain(false);

$("equal").onclick = () => packAgain(true);

$("resetCollage").onclick = () => {
  workspace.resetCollage();
  inspect(null);
  renderPoster();
};

$("export").onclick = async () => {
  await document.fonts.ready;
  await posterFontsReady;
  if (workspace.mode === "microcosm") {
    pauseMicrocosm();
    const c = document.createElement("canvas");
    renderMicrocosm(c.getContext("2d"), false);
    c.toBlob(
      async (blob) => download("microcosm-a4-landscape.png", await pngAt300Dpi(blob)),
      "image/png",
    );
    return;
  }
  if (workspace.mode === "collage") {
    const c = document.createElement("canvas");

    renderPoster(c.getContext("2d"), false);
    c.toBlob(
      async (blob) =>
        download(
          workspace.archive.participant.collageTheme === "dark"
            ? "collage-a4-dark.png"
            : "collage-a4.png",
          await pngAt300Dpi(blob),
        ),
      "image/png",
    );
  } else if (isConstellationPoster()) {
    const c = document.createElement("canvas");

    renderConstellationPoster(c.getContext("2d"), false);
    if (constellationPage.unplaced.length) {
      message(
        "importStatus",
        "Some labels do not fit this A4 composition. Reduce the selected relations before exporting.",
        true,
      );
      return;
    }
    c.toBlob(
      async (blob) =>
        download("constellation-a4-landscape.png", await pngAt300Dpi(blob)),
      "image/png",
    );
  } else {
    field.toBlob((blob) => download("constellation.png", blob), "image/png");
  }
};

async function printCollagePoster() {
  await document.fonts.ready;
  await posterFontsReady;
  const old = workspace.selected;

  workspace.select(null);
  renderPoster();
  await renderingHost.flush();
  window.print();
  workspace.select(old);
  renderPoster();
}

const archiveImport = createArchiveImport({
  input: $("import"),
  label: $("import").closest("label"),
  status: (text, error = false) => message("importStatus", text, error),
  open: load,
});

new ResizeObserver(() => {
  if (workspace.mode === "constellation") {
    fitGraph();
  }
}).observe($("stage"));

posterFontsReady
  .then(() => {
    constellationCacheKey = "";
    render();
  })
  .catch(() =>
    message(
      "importStatus",
      "Poster fonts could not be loaded. Reload this workspace before exporting.",
      true,
    ),
  );

/* studio-facade.js */
/** The participant runtime can use this interface without accessing UI internals. */
function createStudioFacade() {
  const fragments = Object.freeze({
    all: () => collageObjects(),
    placement: (id) =>
      placement(workspace.archive.objects.find((item) => item.id === id)),
    update: (id, changes) =>
      editObject(
        workspace.archive.objects.find((item) => item.id === id),
        changes,
      ),
    bounds: () => ({ ...posterContentBounds() }),
  });

  return Object.freeze({
    get data() {
      return workspace.archive;
    },
    get view() {
      return workspace.mode;
    },
    get format() {
      return workspace.mode === "collage" ||
        workspace.mode === "microcosm" ||
        isConstellationPoster()
        ? "poster"
        : "explore";
    },
    get selection() {
      return workspace.selected ? { ...workspace.selected } : null;
    },
    get assetCount() {
      return images.size;
    },
    get fontsReady() {
      return posterFontsReady;
    },
    get fragments() {
      return fragments;
    },

    open: (data) => load(data),
    enableImport: () => archiveImport.enable(),
    show: (view) => setMode(view),
    select: (item) => {
      inspect(item);
      render();
    },
    refresh: () => render(),
    reportError: (text) => message("importStatus", text, true),
    canvas: (view) => (view === "collage" ? poster : field),
    asset: (id) => images.get(id),
    registerRenderer: (renderer) => renderingHost.register(renderer),

    microcosm: () => ({
      playing: microcosmPlaying,
      lens: workspace.microcosmState?.lens,
      detailed: workspace.microcosmState?.detailed,
      projection: workspace.microcosmState?.projection,
      method: workspace.microcosmState?.method,
      groups: (workspace.microcosmState?.groups || []).map((g) => ({
        ...g,
        itemIds: [...g.itemIds],
      })),
      nodes: (workspace.microcosmState?.nodes || []).map((n) => ({ ...n })),
    }),
    scene: () =>
      workspace.mode === "microcosm" && workspace.microcosmState
        ? {
            nodes: workspace.microcosmState.nodes.map((n) => ({ ...n })),
            edges: [],
            labels: [],
            scale: microcosmCamera.zoom,
            pan: {
              x:
                microcosmCamera.x +
                (1 - microcosmCamera.zoom) *
                  (workspace.microcosmState.bounds.x +
                    workspace.microcosmState.bounds.w / 2),
              y:
                microcosmCamera.y +
                (1 - microcosmCamera.zoom) *
                  (workspace.microcosmState.bounds.y +
                    workspace.microcosmState.bounds.h / 2),
            },
          }
        : {
            nodes: nodes.map((item) => ({ ...item })),
            edges: graphEdges.map((item) => ({ ...item })),
            labels: graphLabels.map((item) => ({ ...item })),
            scale,
            pan: { ...pan },
          },

    renderTo: (context, view = workspace.mode, interactive = false) => {
      if (view === "collage") {
        return renderPoster(context, interactive);
      }
      if (view === "microcosm") {
        return renderMicrocosm(context, interactive);
      }
      return renderConstellationPoster(context, interactive);
    },

    configure: (settings) => {
      workspace.configurePoster(settings);
      Object.assign(colors, settings.relationColors || {});
      itemFrameStyle.color = settings.itemRectangleColor || itemFrameStyle.color;
    },
  });
}

/* microcosm-view.js */
/* Microcosm shares the landscape poster, fonts and p5 screenshot drawers. */
let microcosmPlaying = false;
let microcosmFrame = null,
  microcosmLastTick = 0;
let microcosmCamera = { zoom: 1, x: 0, y: 0 };
const microcosmPalette = MICROCOSM_PALETTE;
function updateDatasetSummary(themeCount) {
  if (!workspace.archive) {
    return;
  }
  const count =
    themeCount ?? (Number(workspace.archive.participant.microcosm?.count) || 0);
  const themes = count || Microcosm.defaultThemeCount(workspace.archive);
  $("datasetMeta").textContent =
    `${workspace.archive.items.length} screenshots / ${workspace.archive.relations.length} proposed connections` +
    (workspace.archive.objects
      ? ` / ${collageObjects().length} collage fragments`
      : "") +
    ` / ${themes} proposed themes`;
}
function prepareMicrocosm() {
  if (!workspace.archive) {
    return null;
  }
  const previous = workspace.microcosmState;
  const previousKey = workspace.microcosmKey;
  workspace.prepareMicrocosm();
  const saved = workspace.archive.participant.microcosm || {};
  const { count, lens } = workspace.microcosmState;
  if (previous !== workspace.microcosmState || previousKey !== workspace.microcosmKey) {
    updateDatasetSummary(workspace.microcosmState.groups.length);
    microcosmPlaying =
      saved.paused === undefined
        ? !matchMedia("(prefers-reduced-motion: reduce)").matches
        : !saved.paused;
    microcosmCamera = { zoom: 1, x: 0, y: 0 };
    $("microcosmCount").value = count;
    $("microcosmLens").value = lens;
    $("microcosmLens").disabled = !workspace.archive.microcosm?.lenses;
    $("microcosmFocus").replaceChildren(el("option", "All themes"));
    $("microcosmFocus").firstChild.value = "";
    for (const group of workspace.microcosmState.groups) {
      const option = el("option", `${group.label} · ${group.itemIds.length}`);
      option.value = group.id;
      $("microcosmFocus").append(option);
    }
    $("microcosmFocus").value = workspace.microcosmState.groups.some(
      (g) => g.id === saved.focus,
    )
      ? saved.focus
      : "";
    updateMicrocosmButtons();
  }
  return workspace.microcosmState;
}
function updateMicrocosmButtons() {
  $("microcosmPlay").textContent = microcosmPlaying ? "Pause" : "Play";
  $("microcosmPlay").setAttribute("aria-pressed", String(microcosmPlaying));
}
function saveMicrocosmSnapshot() {
  if (
    !workspace.archive ||
    !workspace.microcosmState ||
    workspace.microcosmState.datasetId !== workspace.archive.datasetId
  ) {
    return;
  }
  workspace.updateParticipant({
    microcosm: {
      count: workspace.microcosmState.count,
      lens: $("microcosmLens").value,
      projectionMode: "umap",
      paused: !microcosmPlaying,
      focus: $("microcosmFocus").value,
      snapshot: Microcosm.snapshot(workspace.microcosmState),
    },
  });
}
function stopMicrocosmFrames() {
  if (microcosmFrame !== null) {
    cancelAnimationFrame(microcosmFrame);
  }
  microcosmFrame = null;
  microcosmLastTick = 0;
}
function scheduleMicrocosm() {
  if (
    workspace.mode !== "microcosm" ||
    !workspace.archive ||
    !microcosmPlaying ||
    document.hidden ||
    microcosmFrame !== null
  ) {
    return;
  }
  microcosmFrame = requestAnimationFrame((time) => {
    microcosmFrame = null;
    if (workspace.mode !== "microcosm" || !microcosmPlaying || document.hidden) {
      return;
    }
    if (!microcosmLastTick) {
      microcosmLastTick = time;
    }
    if (time - microcosmLastTick >= 32) {
      prepareMicrocosm();
      workspace.advanceMicrocosm((time - microcosmLastTick) / 1000);
      microcosmLastTick = time;
      renderMicrocosm();
    }
    scheduleMicrocosm();
  });
}
function pauseMicrocosm() {
  microcosmPlaying = false;
  stopMicrocosmFrames();
  updateMicrocosmButtons();
  saveMicrocosmSnapshot();
}
function renderMicrocosm(context = graph, interactive = true) {
  return renderingHost.paint("microcosm", context, interactive, () =>
    paintMicrocosm(context, interactive),
  );
}
function microcosmPath(context, points) {
  if (!points.length) {
    return;
  }
  const last = points.at(-1),
    first = points[0];
  context.beginPath();
  context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    context.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  });
  context.closePath();
}
function paintMicrocosm(context, interactive) {
  prepareConstellationSurface(context, interactive);
  if (!workspace.archive) {
    return;
  }
  const state = prepareMicrocosm(),
    focus = $("microcosmFocus").value;
  context.fillStyle = "#fff";
  context.font = "700 10px Basteleur,serif";
  context.letterSpacing = "-.4px";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(
    workspace.archive.participant.constellationTitle || "Screenshot Archeology",
    8,
    16,
  );
  context.letterSpacing = "0px";
  context.font = "4px Junction,Arial";
  context.textAlign = "right";
  const cellWidth = 281 / state.groups.length;
  state.groups.forEach((group, i) => {
    const active = !focus || focus === group.id,
      color = microcosmPalette[group.colorIndex % microcosmPalette.length];
    context.fillStyle = active ? color : "#191919";
    context.fillRect(8 + i * cellWidth, 24, cellWidth - 0.25, 12);
    context.fillStyle = active ? "#090909" : color;
    context.font = "2.6px Junction,Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = ConstellationPoster.wrap(
      group.label,
      cellWidth - 4,
      (t) => context.measureText(t).width,
    ).slice(0, 2);
    lines.forEach((line, n) =>
      context.fillText(line, 8 + (i + 0.5) * cellWidth, 28.2 + n * 2.8),
    );
    context.font = "2.2px Junction,Arial";
    context.fillText(`${group.itemIds.length} traces`, 8 + (i + 0.5) * cellWidth, 33.9);
  });
  const b = state.bounds,
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  context.save();
  context.beginPath();
  context.rect(8, 41, 281, 154);
  context.clip();
  if (interactive) {
    context.translate(cx + microcosmCamera.x, cy + microcosmCamera.y);
    context.scale(microcosmCamera.zoom, microcosmCamera.zoom);
    context.translate(-cx, -cy);
  }
  for (const group of state.groups) {
    const members = state.nodes.filter((n) => n.groupId === group.id),
      color = microcosmPalette[group.colorIndex % microcosmPalette.length];
    const points = Microcosm.hull(
      members.flatMap((n) => [
        { x: n.x - n.w / 2 - 3, y: n.y - n.h / 2 - 3 },
        { x: n.x + n.w / 2 + 3, y: n.y - n.h / 2 - 3 },
        { x: n.x + n.w / 2 + 3, y: n.y + n.h / 2 + 3 },
        { x: n.x - n.w / 2 - 3, y: n.y + n.h / 2 + 3 },
      ]),
    );
    context.globalAlpha = focus && focus !== group.id ? 0.12 : 1;
    microcosmPath(context, points);
    context.fillStyle = color + "10";
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 0.22;
    context.setLineDash([0.7, 1.3]);
    context.stroke();
    context.setLineDash([]);
    const top = Math.max(44, Math.min(...members.map((n) => n.y - n.h / 2)) - 5);
    context.fillStyle = color;
    context.font = "3px Junction,Arial";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    const lines = ConstellationPoster.wrap(
      group.label,
      55,
      (t) => context.measureText(t).width,
    );
    lines.forEach((line, i) =>
      context.fillText(line, group.x, top - (lines.length - 1 - i) * 3.3),
    );
  }
  context.globalAlpha = 1;
  if (workspace.selected?.type === "source") {
    const from = state.nodes.find((n) => n.id === workspace.selected.id);
    if (from) {
      for (const neighbour of Microcosm.nearest(state, from.id, 2)) {
        const to = state.nodes.find((n) => n.id === neighbour.id);
        context.strokeStyle = "#d4ed70";
        context.lineWidth = 0.3;
        context.setLineDash([1, 1]);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        context.setLineDash([]);
      }
    }
  }
  for (const node of state.nodes) {
    const group = state.groups.find((g) => g.id === node.groupId),
      color = microcosmPalette[group.colorIndex % microcosmPalette.length];
    context.save();
    context.globalAlpha = focus && focus !== node.groupId ? 0.2 : 1;
    context.translate(node.x, node.y);
    context.rotate(Math.sin(node.phase + state.time * 0.25) * 0.07);
    context.fillStyle = "#090909";
    context.fillRect(-node.w / 2 - 0.8, -node.h / 2 - 0.8, node.w + 1.6, node.h + 1.6);
    renderingHost.element(
      "screenshot",
      context,
      {
        id: node.id,
        image: images.get(node.id),
        x: -node.w / 2,
        y: -node.h / 2,
        width: node.w,
        height: node.h,
      },
      () =>
        context.drawImage(
          images.get(node.id),
          -node.w / 2,
          -node.h / 2,
          node.w,
          node.h,
        ),
    );
    context.globalAlpha = 1;
    context.strokeStyle = workspace.selected?.id === node.id ? "#fff" : color;
    context.lineWidth = workspace.selected?.id === node.id ? 0.55 : 0.18;
    context.strokeRect(
      -node.w / 2 - 0.3,
      -node.h / 2 - 0.3,
      node.w + 0.6,
      node.h + 0.6,
    );
    context.restore();
  }
  context.restore();
  context.globalAlpha = 1;
  drawConstellationFooter(context);
  if (interactive) {
    $("count").classList.remove("error");
    $("count").textContent =
      `${state.nodes.length} screenshots · ${state.groups.length} proposed themes · ${state.projection}`;
    updateMicrocosmButtons();
    scheduleMicrocosm();
  }
}
function microcosmPoint(x, y) {
  const r = field.getBoundingClientRect(),
    b = prepareMicrocosm().bounds,
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  return {
    x: cx + ((x * 297) / r.width - cx - microcosmCamera.x) / microcosmCamera.zoom,
    y: cy + ((y * 210) / r.height - cy - microcosmCamera.y) / microcosmCamera.zoom,
  };
}
function hitMicrocosm(x, y) {
  const r = field.getBoundingClientRect(),
    state = prepareMicrocosm(),
    px = (x * 297) / r.width,
    py = (y * 210) / r.height;
  if (py >= 24 && py <= 36 && px >= 8 && px <= 289) {
    return {
      type: "microcosm-theme",
      id: state.groups[
        Math.min(
          state.groups.length - 1,
          Math.floor((px - 8) / (281 / state.groups.length)),
        )
      ].id,
    };
  }
  const point = microcosmPoint(x, y);
  for (const node of state.nodes.slice().reverse()) {
    if (
      Math.abs(point.x - node.x) < node.w / 2 + 1 &&
      Math.abs(point.y - node.y) < node.h / 2 + 1
    ) {
      return { type: "source", id: node.id };
    }
  }
  for (const g of state.groups) {
    if (Math.abs(point.x - g.x) < g.rx && Math.abs(point.y - g.y) < g.ry) {
      return { type: "microcosm-theme", id: g.id };
    }
  }
  return null;
}
function zoomMicrocosm(factor, x, y) {
  const state = prepareMicrocosm(),
    r = field.getBoundingClientRect(),
    b = state.bounds,
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  const ax = (x * 297) / r.width,
    ay = (y * 210) / r.height,
    next = Math.max(0.4, Math.min(5, microcosmCamera.zoom * factor)),
    ratio = next / microcosmCamera.zoom;
  microcosmCamera = {
    zoom: next,
    x: ax - cx - (ax - cx - microcosmCamera.x) * ratio,
    y: ay - cy - (ay - cy - microcosmCamera.y) * ratio,
  };
  renderMicrocosm();
}

/* microcosm-controls.js */
$("microcosmTab").onclick = () => setMode("microcosm");
$("microcosmPlay").onclick = () => {
  if (!workspace.archive) {
    return;
  }
  prepareMicrocosm();
  microcosmPlaying = !microcosmPlaying;
  if (microcosmPlaying) {
    scheduleMicrocosm();
  } else {
    stopMicrocosmFrames();
  }
  updateMicrocosmButtons();
  saveMicrocosmSnapshot();
  renderMicrocosm();
};
$("microcosmCount").onchange = () => {
  if (!workspace.archive) {
    return;
  }
  const count = Number($("microcosmCount").value);
  workspace.updateParticipant({
    microcosm: {
      count,
      lens: $("microcosmLens").value,
      projectionMode: "umap",
      paused: !microcosmPlaying,
    },
  });
  workspace.invalidateMicrocosm();
  prepareMicrocosm();
  saveMicrocosmSnapshot();
  inspect(null);
  renderMicrocosm();
};
for (const control of ["microcosmLens"]) {
  $(control).onchange = () => {
    if (!workspace.archive) {
      return;
    }
    workspace.updateParticipant({
      microcosm: {
        count: Number($("microcosmCount").value),
        lens: $("microcosmLens").value,
        projectionMode: "umap",
        paused: !microcosmPlaying,
      },
    });
    workspace.invalidateMicrocosm();
    prepareMicrocosm();
    saveMicrocosmSnapshot();
    inspect(null);
    renderMicrocosm();
  };
}
$("microcosmFocus").onchange = () => {
  const id = $("microcosmFocus").value;
  inspect(id ? { type: "microcosm-theme", id } : null);
  saveMicrocosmSnapshot();
  renderMicrocosm();
};
$("microcosmFit").onclick = () => {
  microcosmCamera = { zoom: 1, x: 0, y: 0 };
  renderMicrocosm();
};
$("printCurrent").onclick = () => {
  if (!workspace.archive) {
    return;
  }
  if (workspace.mode === "microcosm") {
    return printMicrocosmPoster();
  }
  if (workspace.mode === "collage") {
    return printCollagePoster();
  }
  return printConstellationPoster();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopMicrocosmFrames();
  } else {
    scheduleMicrocosm();
  }
});
function showMicrocosmOverview(panel) {
  const state = prepareMicrocosm();
  panel.append(
    el(
      "p",
      "Switch between specific content, visual characteristics and their combination. These are proposed readings; select a trace to inspect the visible evidence.",
      "muted",
    ),
  );
  panel.append(el("p", state.method + " · " + state.projection, "small"));
  if (!state.detailed) {
    panel.append(
      el(
        "p",
        "This archive uses older, broad features. Reanalyse in the analyzer to enable detailed content and visual lenses.",
        "small",
      ),
    );
  }
  panel.append(
    el(
      "p",
      "Small proposed groups support comparison; their size is limited for exploration. Labels are clues from members, not traits guaranteed for every image.",
      "small",
    ),
  );
  for (const group of state.groups) {
    action(
      panel,
      `${group.label} · ${group.itemIds.length}`,
      () => {
        inspect({ type: "microcosm-theme", id: group.id });
        renderMicrocosm();
      },
      true,
    ).classList.add("source-button");
  }
}
function showMicrocosmTheme(panel, id) {
  const state = prepareMicrocosm(),
    group = state.groups.find((g) => g.id === id);
  if (!group) {
    return showMicrocosmOverview(panel);
  }
  $("microcosmFocus").value = id;
  panel.append(
    el("p", "Proposed theme", "type-label"),
    el("h2", group.label),
    ...(group.summary ? [el("p", group.summary)] : []),
    el(
      "p",
      `${group.itemIds.length} screenshots · ${group.keywords.join(" · ")}`,
      "rule",
    ),
  );
  panel.append(
    el(
      "p",
      state.method +
        (group.summarySource === "cluster-summary"
          ? ". Theme names summarise the members through the selected lens."
          : ". This older archive shows representative descriptors; reanalyse to obtain theme summaries."),
      "small",
    ),
  );
  for (const sourceId of group.itemIds) {
    const observation = workspace.archive.observations.find((o) => o.id === sourceId);
    action(
      panel,
      observation?.title || sourceId,
      () => {
        inspect({ type: "source", id: sourceId });
        renderMicrocosm();
      },
      true,
    ).classList.add("source-button");
  }
  action(panel, "Show all themes", () => {
    $("microcosmFocus").value = "";
    inspect(null);
    saveMicrocosmSnapshot();
    renderMicrocosm();
  });
}
function addMicrocosmSourceContext(panel, id) {
  const state = prepareMicrocosm(),
    group = state.groups.find((g) => g.itemIds.includes(id));
  if (group) {
    action(
      panel,
      "Theme · " + group.label,
      () => {
        inspect({ type: "microcosm-theme", id: group.id });
        renderMicrocosm();
      },
      true,
    ).classList.add("source-button");
  }
  const detail = workspace.archive.microcosm?.items?.find((o) => o.id === id);
  if (detail) {
    for (const [key, title] of [
      ["content", "Specific content"],
      ["visual", "Visual evidence"],
      ["design_references", "Possible design associations"],
    ]) {
      if (!detail[key]?.length) {
        continue;
      }
      panel.append(el("h3", title));
      for (const entry of detail[key]) {
        panel.append(el("p", entry.label));
        panel.append(
          el(
            "p",
            entry.evidence + (entry.uncertainty ? " · " + entry.uncertainty : ""),
            "small",
          ),
        );
      }
    }
  }
  const nearby = Microcosm.nearest(state, id, 2);
  if (nearby.length) {
    panel.append(el("h3", "Nearby · " + state.lens));
    for (const n of nearby) {
      const observation = workspace.archive.observations.find((o) => o.id === n.id);
      action(
        panel,
        observation?.title || n.id,
        () => {
          inspect({ type: "source", id: n.id });
          renderMicrocosm();
        },
        true,
      ).classList.add("source-button");
    }
  }
}
async function printMicrocosmPoster() {
  if (!workspace.archive) {
    return;
  }
  pauseMicrocosm();
  await document.fonts.ready;
  await posterFontsReady;
  const c = document.createElement("canvas");
  renderMicrocosm(c.getContext("2d"), false);
  const win = window.open("", "_blank");
  if (!win) {
    message("importStatus", "Allow the print window, or export the A4 PNG.", true);
    return;
  }
  win.document.write(
    "<!doctype html><html><head><title>Microcosm · A4 landscape</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;background:#090909}img{display:block;width:297mm;height:210mm}</style></head><body>",
  );
  const im = win.document.createElement("img");
  im.alt = "Screenshot Archaeology Microcosm poster";
  im.onload = () => {
    win.focus();
    win.print();
  };
  im.src = c.toDataURL("image/png");
  win.document.body.append(im);
  win.document.close();
}

function render() {
  if (workspace.mode === "collage") {
    renderPoster();
  } else if (workspace.mode === "microcosm") {
    renderMicrocosm();
  } else {
    renderGraph();
  }
}
window.addEventListener("DOMContentLoaded", () => {
  message("importStatus", "");
});
export const ScreenshotWorkshop = createStudioFacade();
// Public compatibility facade for workshop integrations; rendering uses module imports.
window.ScreenshotWorkshop = ScreenshotWorkshop;
