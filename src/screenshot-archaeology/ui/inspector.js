export function createInspectorController({
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
}) {
  class InspectorController {
    #panel;

    constructor(panel) {
      this.#panel = panel;
    }

    show(value) {
      workspace.select(value);
      this.#panel.replaceChildren();

      if (!workspace.archive) {
        this.#panel.append(
          el("p", "Select a screenshot, a connection or a collage fragment.", "muted"),
        );
        return;
      }

      if (!value) {
        return this.#showOverview();
      }
      if (value.type === "microcosm-theme") {
        return showMicrocosmTheme(this.#panel, value.id);
      }
      if (value.type === "object") {
        return this.#showFragment(value);
      }
      if (value.type === "relation") {
        return this.#showRelation(value);
      }
      this.#showSource(value);
    }

    #showOverview() {
      const panel = this.#panel;

      if (workspace.mode === "microcosm") {
        return showMicrocosmOverview(panel);
      }
      if (workspace.mode === "collage") {
        panel.append(
          el(
            "p",
            "Sizes propose a reading of repeated content. They do not measure your personal interest. Drag a fragment or select it below to change its size, angle or inclusion.",
            "muted",
          ),
        );
      } else {
        panel.append(
          el(
            "p",
            "Select a trace or connection to inspect its source evidence and leave your own reading.",
            "muted",
          ),
        );
      }
    }

    #showFragment(value) {
      const panel = this.#panel;

      const obj = workspace.archive.objects.find((o) => o.id === value.id),
        edit = workspace.archive.participant.collage[obj.id] || {};

      panel.append(el("h2", edit.label || obj.label));
      const keep = el("input");

      keep.type = "checkbox";
      keep.checked = !edit.hidden;
      const keepLabel = el("label");

      keepLabel.append(keep, document.createTextNode(" Include on poster"));
      panel.append(keepLabel);
      keep.onchange = () => editObject(obj, { hidden: !keep.checked });
      action(panel, "View original screenshot", () =>
        viewSource(obj.sourceId, obj.bbox),
      );
      const other = el("section");

      other.append(el("h3", "Repeated-content sources"));
      for (const id of obj.recurrence.sourceIds) {
        const src = workspace.archive.items.find((i) => i.id === id);

        action(other, src.filename, () => viewSource(id), true).classList.add(
          "source-button",
        );
      }
      panel.append(other);
    }

    #showRelation(value) {
      const panel = this.#panel;

      const r = workspace.archive.relations.find((r) => r.id === value.id),
        edit = workspace.archive.participant.relations[r.id] || {};

      const relationType = el("p", typeName(r.type), "type-label");
      relationType.style.color = colors[r.type];
      panel.append(relationType, el("h2", edit.label || r.label));
      if (r.rationale) {
        panel.append(el("p", r.rationale, "rule"));
      }
      const label = el("input");

      label.type = "text";
      label.value = edit.label || r.label;
      label.onchange = () => {
        workspace.updateRelation(r.id, { label: label.value });
        buildRelationFilters();
        renderGraph();
      };
      inputLabel(panel, "My name for this connection", label);
      for (const side of ["source", "target"]) {
        const source = workspace.archive.items.find((i) => i.id === r[side]),
          section = el("section"),
          evidence = r.evidence[side];

        section.append(
          el("h3", source.filename),
          el("blockquote", evidence.quote || evidence.description),
        );
        action(section, "View source", () => viewSource(source.id, evidence.region));
        panel.append(section);
      }
      const row = el("div", undefined, "inline-actions");

      action(
        row,
        edit.status === "rejected" ? "Restore connection" : "Reject connection",
        () => {
          workspace.updateRelation(r.id, {
            status: edit.status === "rejected" ? "proposed" : "rejected",
          });
          inspect(value);
          renderGraph();
        },
      );
      panel.append(row);
    }

    #showSource(value) {
      const panel = this.#panel;

      const source = workspace.archive.items.find((i) => i.id === value.id),
        obs = workspace.archive.observations.find((o) => o.id === value.id);

      panel.append(el("h2", obs.title));
      const im = el("img");

      im.src = source.preview;
      im.className = "trace-preview";
      im.alt = source.filename;
      panel.append(im, el("p", obs.summary), el("p", source.filename, "small"));
      for (const uncertainty of obs.uncertainties || []) {
        panel.append(el("p", uncertainty, "small"));
      }
      action(panel, "View original screenshot", () => viewSource(source.id));
      if (workspace.mode === "microcosm") {
        addMicrocosmSourceContext(panel, source.id);
      }
      const connected = workspace.archive.relations.filter(
        (r) => r.source === source.id || r.target === source.id,
      );
      const section = el("section");

      section.append(el("h3", "Connections"));
      for (const r of connected) {
        action(
          section,
          workspace.archive.participant.relations[r.id]?.label || r.label,
          () => {
            inspect({ type: "relation", id: r.id });
            renderGraph();
          },
          true,
        ).classList.add("source-button");
      }
      panel.append(section);
    }
  }
  return InspectorController;
}
