const contentBounds = Object.freeze({
  x: 7,
  y: 36,
  width: 196,
  height: 240,
});
const LEGACY_LAYOUT = Object.freeze({
  widthMm: 190,
  heightMm: 257,
  centreXMm: 105,
  centreYMm: 158.5,
  targetCentreYMm: 156,
});
const defaults = {
  id: "archaeology-poster-v1",
  contentBounds,
  titleFont: "Basteleur",
  titleFontWeight: 700,
  titleLetterSpacingEm: -0.04,
  footerFont: "Junction",
};
const title = "Screenshot Archeology",
  footerLeft = "Processing Community Day @ Boston",
  footerRight = "Nov 1, 2026";

function adopt(archive) {
  if (!archive.collage) {
    return archive;
  }
  const next = {
    ...archive,
    collage: {
      ...archive.collage,
      items: archive.collage.items.map((item) => ({ ...item })),
      template: archive.collage.template ? { ...archive.collage.template } : null,
    },
    participant: {
      ...archive.participant,
      collage: Object.fromEntries(
        Object.entries(archive.participant.collage || {}).map(([id, edit]) => [
          id,
          { ...edit },
        ]),
      ),
      collageLayout: archive.participant.collageLayout?.map((item) => ({
        ...item,
      })),
    },
  };
  const layout = next.collage;
  if (!layout.template) {
    const factor = Math.min(
        contentBounds.width / LEGACY_LAYOUT.widthMm,
        contentBounds.height / LEGACY_LAYOUT.heightMm,
      ),
      dx = LEGACY_LAYOUT.centreXMm * (1 - factor),
      dy = LEGACY_LAYOUT.targetCentreYMm - LEGACY_LAYOUT.centreYMm * factor;
    const fit = (p) => {
      p.xMm = p.xMm * factor + dx;
      p.yMm = p.yMm * factor + dy;
      p.widthMm *= factor;
      p.heightMm *= factor;
    };

    layout.items.forEach(fit);
    next.participant.collageLayout?.forEach(fit);
    for (const edit of Object.values(next.participant.collage || {})) {
      if (Number.isFinite(edit.xMm)) {
        edit.xMm = edit.xMm * factor + dx;
      }
      if (Number.isFinite(edit.yMm)) {
        edit.yMm = edit.yMm * factor + dy;
      }
    }
    layout.template = structuredClone(defaults);
    if (!layout.title || layout.title === "Collected traces") {
      layout.title = title;
    }
  }
  layout.template.titleFontWeight ??= 700;
  layout.template.titleLetterSpacingEm ??= -0.04;
  layout.footerLeft ??= footerLeft;
  layout.footerRight ??= footerRight;
  return next;
}

export const PosterTemplate = {
  contentBounds,
  defaults,
  title,
  footerLeft,
  footerRight,
  adopt,
};
export default PosterTemplate;
