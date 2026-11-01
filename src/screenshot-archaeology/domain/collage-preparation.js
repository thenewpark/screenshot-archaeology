export async function prepareCollageSizing(
  data,
  assets,
  { pack, onStatus = () => {} },
) {
  if (!data.collage || data.collage.sizeContrast === 2) {
    return;
  }
  if (data.participant.collageLayout || data.participant.collageSizing === "equal") {
    return;
  }
  if (
    Object.values(data.participant.collage || {}).some((edit) =>
      ["xMm", "yMm", "scale", "rotation"].some((key) => Object.hasOwn(edit, key)),
    )
  ) {
    return;
  }
  const ids = new Set(data.collage.items.map((p) => p.objectId));
  const objects = (data.objects || []).filter(
    (o) => o.kind !== "text_fragment" && ids.has(o.id),
  );
  const weights = objects.map((o) => o.relativeAreaWeight || 1);
  if (objects.length && Math.max(...weights) > Math.min(...weights)) {
    onStatus("Arranging the collage with more size variation…");
    data.collage.items = await pack(
      objects,
      (o) => assets.get("poster:" + o.id) || assets.get(o.id),
    );
  }
  data.collage.sizeContrast = 2;
}
