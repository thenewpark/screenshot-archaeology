export function validateArchive(data) {
  if (
    !data ||
    !["pcd.archive/2", "pcd.archive/3"].includes(data.schema) ||
    !(data.items?.length >= 20 && data.items.length <= 30) ||
    data.observations?.length !== data.items.length ||
    data.pairAssessments?.length !== (data.items.length * (data.items.length - 1)) / 2
  ) {
    throw Error(
      "Open a complete workshop archive containing 20–30 sources and every pair assessment.",
    );
  }
  const ids = new Set(data.items.map((i) => i.id));

  if (ids.size !== data.items.length) {
    throw Error("Screenshot IDs are duplicated.");
  }
  for (const item of data.items) {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(item.preview)) {
      throw Error("A screenshot preview is missing or unsupported.");
    }
  }
  for (const r of data.relations) {
    if (!ids.has(r.source) || !ids.has(r.target) || r.source === r.target) {
      throw Error("A relation has an invalid source.");
    }
  }
  if (data.schema === "pcd.archive/3") {
    if (!data.objects?.length || !data.collage?.items) {
      throw Error("The collage data is incomplete.");
    }
    const objectIds = new Set(data.objects.map((o) => o.id));
    const placed = data.collage.items.map((p) => p.objectId),
      excluded = data.collage.excludedObjectIds || [],
      covered = new Set([...placed, ...excluded]);

    if (
      objectIds.size !== data.objects.length ||
      covered.size !== objectIds.size ||
      placed.length + excluded.length !== covered.size ||
      [...covered].some((id) => !objectIds.has(id))
    ) {
      throw Error("Collage objects, placements or exclusions are duplicated/missing.");
    }
    for (const o of data.objects) {
      if (
        !ids.has(o.sourceId) ||
        !/^data:image\/png;base64,/.test(o.asset) ||
        !o.bbox?.every(Number.isFinite)
      ) {
        throw Error("An artifact has an invalid source or PNG.");
      }
    }
    for (const o of data.objects) {
      if (o.posterAsset && !/^data:image\/png;base64,/.test(o.posterAsset)) {
        throw Error("A decorative poster asset must be an embedded PNG.");
      }
    }
    for (const p of data.collage.items) {
      if (
        !objectIds.has(p.objectId) ||
        !["xMm", "yMm", "widthMm", "heightMm"].every((k) => Number.isFinite(p[k]))
      ) {
        throw Error("A collage placement is invalid.");
      }
    }
  }
  data = { ...data, participant: { ...data.participant } };
  for (const name of ["relations", "notes", "positions", "groups", "collage"]) {
    data.participant[name] = { ...data.participant[name] };
  }
  return data;
}
