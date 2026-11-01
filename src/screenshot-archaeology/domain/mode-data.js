import { PosterTemplate } from "../poster-template.js";

export function baseBoxes(data) {
  return data.participant.collageLayout || data.collage.items;
}

export function collageObjects(data) {
  const ids = new Set((data?.collage?.items || []).map((p) => p.objectId));

  return (data?.objects || []).filter(
    (o) => o.kind !== "text_fragment" && ids.has(o.id),
  );
}

export function placement(data, obj) {
  const base =
      baseBoxes(data).find((p) => p.objectId === obj.id) ||
      data.collage.items.find((p) => p.objectId === obj.id),
    edit = data.participant.collage[obj.id] || {};

  return {
    objectId: obj.id,
    xMm: edit.xMm ?? base.xMm,
    yMm: edit.yMm ?? base.yMm,
    widthMm: base.widthMm * (edit.scale ?? 1),
    heightMm: base.heightMm * (edit.scale ?? 1),
    rotation: edit.rotation ?? base.rotation ?? 0,
    hidden: edit.hidden === true,
  };
}

export function posterContentBounds(data) {
  return data?.collage?.template?.contentBounds || PosterTemplate.contentBounds;
}

export function clampPlacement(data, obj, p) {
  p = { ...p };
  const region = posterContentBounds(data),
    rad = (p.rotation * Math.PI) / 180,
    center = { x: p.xMm + p.widthMm / 2, y: p.yMm + p.heightMm / 2 };
  let bw = Math.abs(p.widthMm * Math.cos(rad)) + Math.abs(p.heightMm * Math.sin(rad)),
    bh = Math.abs(p.widthMm * Math.sin(rad)) + Math.abs(p.heightMm * Math.cos(rad));
  const fit = Math.min(1, region.width / bw, region.height / bh);

  p.widthMm *= fit;
  p.heightMm *= fit;
  bw *= fit;
  bh *= fit;
  const cx = Math.min(
      region.x + region.width - bw / 2,
      Math.max(region.x + bw / 2, center.x),
    ),
    cy = Math.min(
      region.y + region.height - bh / 2,
      Math.max(region.y + bh / 2, center.y),
    );

  p.xMm = cx - p.widthMm / 2;
  p.yMm = cy - p.heightMm / 2;
  return p;
}

export function relationLabel(data, relation) {
  return data.participant.relations[relation.id]?.label?.trim() || relation.label;
}

export function relationKey(data, relation) {
  return relation.type + "|" + relationLabel(data, relation).trim().toLocaleLowerCase();
}

export function visibleRelations(data, enabledRelationLabels) {
  return data.relations.filter(
    (r) =>
      data.participant.relations[r.id]?.status !== "rejected" &&
      enabledRelationLabels.has(relationKey(data, r)),
  );
}
