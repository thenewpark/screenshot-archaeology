import { validateArchive } from "./archive.js";
import { PosterTemplate } from "../poster-template.js";
import * as modeData from "./mode-data.js";
import { Microcosm } from "../microcosm-model.js";

const TRANSFORM_FIELDS = ["xMm", "yMm", "scale", "rotation"];

/** Application state and editing commands. No DOM, canvas or p5 dependency. */
export class Workspace {
  #posterSettings = {};
  configurePoster(settings) {
    this.#posterSettings = { ...settings };
  }
  applyPosterSettings(data) {
    const settings = this.#posterSettings;
    const participant = { ...data.participant };
    if (settings.title != null) {
      participant.collageTitle = settings.title;
      participant.constellationTitle = settings.title;
    }
    if (settings.footerLeft != null) {
      participant.collageFooterLeft = settings.footerLeft;
    }
    if (settings.footerRight != null) {
      participant.collageFooterRight = settings.footerRight;
    }
    return { ...data, participant };
  }

  #archive = null;
  #loadRevision = 0;
  get archive() {
    return this.#archive;
  }

  async open(input, { loadAssets, prepareSizing = async () => {} }) {
    const revision = ++this.#loadRevision;
    let data = validateArchive(input);
    data = this.applyPosterSettings(data);
    data = PosterTemplate.adopt(data);
    const assets = await loadAssets(data);
    if (revision !== this.#loadRevision) {
      return null;
    }
    await prepareSizing({ data, assets });
    if (revision !== this.#loadRevision) {
      return null;
    }
    this.#archive = data;
    this.select(null);
    this.microcosmState = null;
    this.microcosmKey = "";
    this.normalisePlacements();
    return { assets };
  }

  normalisePlacements() {
    this.collageObjects().forEach((obj) => {
      const original = this.placement(obj);
      const bounded = this.clampPlacement(obj, { ...original });
      const changed = ["xMm", "yMm", "widthMm", "heightMm"].some(
        (key) => Math.abs(original[key] - bounded[key]) > 0.0001,
      );
      if (!changed) {
        return;
      }
      const base = this.baseBoxes().find((item) => item.objectId === obj.id);
      this.updateFragment(obj.id, {
        xMm: bounded.xMm,
        yMm: bounded.yMm,
        scale: bounded.widthMm / base.widthMm,
      });
    });
  }
  #mode = "constellation";
  get mode() {
    return this.#mode;
  }
  show(mode) {
    this.#mode = mode;
    this.select(null);
  }
  #selected = null;
  get selected() {
    return this.#selected;
  }
  select(selection) {
    this.#selected = selection;
  }
  enabledRelationLabels = new Set();
  microcosmState = null;
  microcosmKey = "";
  invalidateMicrocosm() {
    this.microcosmKey = "";
  }

  baseBoxes() {
    return modeData.baseBoxes(this.archive);
  }
  collageObjects() {
    return modeData.collageObjects(this.archive);
  }
  placement(obj) {
    return modeData.placement(this.archive, obj);
  }
  posterContentBounds() {
    return modeData.posterContentBounds(this.archive);
  }
  clampPlacement(obj, placement) {
    return modeData.clampPlacement(this.archive, obj, placement);
  }
  relationLabel(relation) {
    return modeData.relationLabel(this.archive, relation);
  }
  relationKey(relation) {
    return modeData.relationKey(this.archive, relation);
  }
  visibleRelations() {
    return modeData.visibleRelations(this.archive, this.enabledRelationLabels);
  }

  #relationKeys = new Set();
  relationGroups(reset = false) {
    const groups = new Map();
    this.archive.relations.forEach((relation) => {
      const key = this.relationKey(relation);
      if (!groups.has(key)) {
        groups.set(key, { label: this.relationLabel(relation), type: relation.type });
      }
    });
    if (reset) {
      this.enabledRelationLabels.clear();
    }
    groups.forEach((_, key) => {
      if (reset || !this.#relationKeys.has(key)) {
        this.setRelationEnabled(key, true);
      }
    });
    this.#relationKeys = new Set(groups.keys());
    return groups;
  }

  setRelationEnabled(key, enabled) {
    if (enabled) {
      this.enabledRelationLabels.add(key);
    } else {
      this.enabledRelationLabels.delete(key);
    }
  }

  updateParticipant(changes) {
    this.archive.participant = { ...this.archive.participant, ...changes };
  }

  updateRelation(id, changes) {
    const relations = this.archive.participant.relations;
    this.updateParticipant({
      relations: { ...relations, [id]: { ...relations[id], ...changes } },
    });
  }

  updateFragment(id, changes) {
    const collage = this.archive.participant.collage;
    this.updateParticipant({
      collage: { ...collage, [id]: { ...collage[id], ...changes } },
    });
  }

  editObject(obj, changes) {
    this.updateFragment(obj.id, changes);
    const placement = this.clampPlacement(obj, this.placement(obj));
    const base = this.baseBoxes().find((item) => item.objectId === obj.id);
    this.updateFragment(obj.id, {
      scale: placement.widthMm / base.widthMm,
      xMm: placement.xMm,
      yMm: placement.yMm,
    });
    return placement;
  }

  clearFragmentTransforms(includeHidden = false) {
    const fields = includeHidden ? [...TRANSFORM_FIELDS, "hidden"] : TRANSFORM_FIELDS;
    const collage = Object.fromEntries(
      Object.entries(this.archive.participant.collage).map(([id, edit]) => [
        id,
        Object.fromEntries(
          Object.entries(edit).filter(([key]) => !fields.includes(key)),
        ),
      ]),
    );
    this.updateParticipant({ collage });
  }

  applyCollageLayout(placed, visible, equal) {
    const hidden = this.archive.collage.items.filter(
      (item) => !visible.some((obj) => obj.id === item.objectId),
    );
    this.updateParticipant({
      collageLayout: placed.concat(hidden),
      collageSizing: equal ? "equal" : "recurrence",
    });
    this.clearFragmentTransforms();
  }

  resetCollage() {
    const participant = Object.fromEntries(
      Object.entries(this.archive.participant).filter(
        ([key]) => !["collageLayout", "collageSizing"].includes(key),
      ),
    );
    this.archive.participant = participant;
    this.clearFragmentTransforms(true);
  }

  advanceMicrocosm(elapsed) {
    Microcosm.step(this.prepareMicrocosm(), elapsed);
  }

  prepareMicrocosm() {
    if (!this.archive) {
      return null;
    }
    const saved = this.archive.participant.microcosm || {};
    const count = Number(saved.count) || Microcosm.defaultThemeCount(this.archive);
    const lens = saved.lens || "combined";
    const projectionMode = "umap";
    const key =
      this.archive.datasetId + ":" + count + ":" + lens + ":" + projectionMode;
    if (this.microcosmKey !== key || !this.microcosmState) {
      this.microcosmState = Microcosm.build(this.archive, {
        count,
        lens,
        projectionMode,
        snapshot: saved.snapshot,
      });
      this.microcosmKey = key;
    }
    return this.microcosmState;
  }
}
