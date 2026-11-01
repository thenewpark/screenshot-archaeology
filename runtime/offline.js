// Generated from src/sketch.js for direct file opening. Edit src/ modules instead.
(function() {

//#region src/config.js
	const SETTINGS = {
		title: null,
		footerLeft: null,
		footerRight: null,
		screenshotScale: 1,
		relationLineScale: 1,
		itemRectangleColor: "#0000ff",
		relationColors: {
			subject_similarity: "#b9e870",
			shared_property: "#4fe0cf",
			shared_problem: "#ff7b86",
			shared_approach: "#77b7ff",
			complements: "#ffb35c",
			transformation: "#c3a0ff",
			continuation: "#ff9fdf"
		}
	};

//#endregion
//#region src/screenshot-archaeology/rendering/p5-elements.js
/** Drawing only: models arrive prepared in poster millimetres. */
	function createPosterDrawers(SETTINGS) {
		function drawScreenshot(p, screenshot) {
			p.imageMode(p.CORNER);
			p.noTint();
			p.image(screenshot.image, screenshot.x, screenshot.y, screenshot.width, screenshot.height);
		}
		function drawRelation(p, relation) {
			p.stroke(relation.color);
			p.strokeWeight(relation.width * SETTINGS.relationLineScale);
			p.strokeCap(p.SQUARE);
			p.drawingContext.setLineDash(relation.dash);
			p.drawingContext.globalAlpha = relation.opacity;
			for (let i = 1; i < relation.points.length; i++) {
				const from = relation.points[i - 1];
				const to = relation.points[i];
				p.line(from.x, from.y, to.x, to.y);
			}
		}
		function drawLabel(p, label) {
			p.translate(label.x, label.y);
			p.rotate(label.angle);
			p.noStroke();
			const background = label.background;
			p.drawingContext.globalAlpha = background.opacity;
			p.fill(background.color);
			p.rectMode(p.CORNER);
			p.rect(background.x, background.y, background.width, background.height);
			p.drawingContext.globalAlpha = label.opacity;
			p.fill(label.color);
			p.textFont(label.font);
			p.textStyle(p.NORMAL);
			p.textSize(label.size);
			p.textAlign(p.CENTER, p.BASELINE);
			for (const row of label.rows) p.text(row.text, 0, row.y);
		}
		function drawFragment(p, fragment) {
			p.imageMode(p.CENTER);
			p.noTint();
			p.translate(fragment.x + fragment.width / 2, fragment.y + fragment.height / 2);
			p.rotate(p.radians(fragment.rotation));
			p.image(fragment.image, 0, 0, fragment.width, fragment.height);
		}
		return {
			screenshot: drawScreenshot,
			relation: drawRelation,
			label: drawLabel,
			fragment: drawFragment
		};
	}

//#endregion
//#region src/screenshot-archaeology/ui/archive-import.js
/** Browser import lifecycle: register first, enable only once the renderer is ready. */
	function createArchiveImport({ input, label, status, open }) {
		let ready = false;
		let busy = false;
		function update() {
			input.disabled = !ready || busy;
			label.setAttribute("aria-disabled", String(input.disabled));
			label.querySelector("span").textContent = busy ? "Opening JSON…" : ready ? "Open analysis JSON" : "Preparing workspace…";
		}
		async function change() {
			const file = input.files?.[0];
			input.value = "";
			if (!file || !ready || busy) return;
			busy = true;
			update();
			status("Reading analysis JSON…");
			try {
				await open(JSON.parse(await file.text()));
				status("");
			} catch (error) {
				status(error.message, true);
			} finally {
				busy = false;
				update();
			}
		}
		input.addEventListener("change", change);
		update();
		return Object.freeze({
			enable() {
				ready = true;
				update();
			},
			dispose() {
				ready = false;
				input.removeEventListener("change", change);
				update();
			}
		});
	}

//#endregion
//#region src/screenshot-archaeology/visual-config.js
	const A4 = Object.freeze({
		portrait: Object.freeze({
			widthMm: 210,
			heightMm: 297,
			widthPx: 2480,
			heightPx: 3508
		}),
		landscape: Object.freeze({
			widthMm: 297,
			heightMm: 210
		})
	});
	const ITEM_FRAME_STYLE = Object.freeze({
		color: "#0000ff",
		lineWidthMm: .36,
		cornerSizeMm: 1.6
	});
	const RELATION_COLORS = Object.freeze({
		subject_similarity: "#b9e870",
		shared_property: "#4fe0cf",
		shared_problem: "#ff7b86",
		shared_approach: "#77b7ff",
		complements: "#ffb35c",
		transformation: "#c3a0ff",
		continuation: "#ff9fdf"
	});
	const MICROCOSM_PALETTE = Object.freeze([
		"#b9e870",
		"#4fe0cf",
		"#77b7ff",
		"#ff7b86",
		"#c3a0ff",
		"#ffb35c",
		"#ff9fdf",
		"#e6e5dc"
	]);

//#endregion
//#region src/screenshot-archaeology/rendering/collage-poster.js
	function createCollagePosterRenderer({ workspace, collageObjects, posterPalette, PosterTemplate, posterContentBounds, placement, posterImage, renderingHost, drawItemFrame }) {
		class CollagePosterRenderer {
			render(context, interactive) {
				if (!workspace.archive?.objects) return;
				this.#prepareCanvas(context);
				this.#drawTitle(context);
				this.#drawFooter(context);
				const count = this.#drawFragments(context);
				this.#drawControls(context, interactive);
				return count;
			}
			#prepareCanvas(context) {
				const width = A4.portrait.widthPx;
				const height = A4.portrait.heightPx;
				if (context.canvas.width !== width || context.canvas.height !== height) {
					context.canvas.width = width;
					context.canvas.height = height;
				}
				context.setTransform(width / 210, 0, 0, height / 297, 0, 0);
				context.fillStyle = posterPalette().background;
				context.fillRect(0, 0, 210, 297);
			}
			#drawTitle(context) {
				const title = workspace.archive.participant.collageTitle ?? workspace.archive.collage.title ?? PosterTemplate.title;
				const tracking = workspace.archive.collage.template?.titleLetterSpacingEm ?? -.04;
				let size = 22;
				let metrics;
				context.textAlign = "left";
				context.textBaseline = "alphabetic";
				do {
					context.font = `700 ${size}px Basteleur,serif`;
					context.letterSpacing = `${size * tracking}px`;
					metrics = context.measureText(title);
					if (Math.max(metrics.width, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) <= 196 && metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent <= 23) break;
					size -= .1;
				} while (size > 1);
				context.fillStyle = posterPalette().text;
				context.fillText(title, 7 + metrics.actualBoundingBoxLeft, 7 + metrics.actualBoundingBoxAscent);
				context.letterSpacing = "0px";
			}
			#drawFooter(context) {
				context.save();
				context.globalAlpha = .5;
				const left = workspace.archive.participant.collageFooterLeft ?? workspace.archive.collage.footerLeft ?? PosterTemplate.footerLeft;
				const right = workspace.archive.participant.collageFooterRight ?? workspace.archive.collage.footerRight ?? PosterTemplate.footerRight;
				let size = 3.8;
				do {
					context.font = `${size}px Junction,sans-serif`;
					if (context.measureText(left).width + context.measureText(right).width <= 184) break;
					size -= .05;
				} while (size > 1);
				context.fillText(left, 7, 291);
				context.textAlign = "right";
				context.fillText(right, 203, 291);
				context.textAlign = "left";
				context.restore();
			}
			#drawFragments(context) {
				const bounds = posterContentBounds();
				let count = 0;
				context.save();
				context.beginPath();
				context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
				context.clip();
				for (const object of collageObjects()) {
					const pose = placement(object);
					if (pose.hidden) continue;
					count++;
					const image = posterImage(object);
					const fragment = {
						id: object.id,
						label: object.label,
						image,
						x: pose.xMm,
						y: pose.yMm,
						width: pose.widthMm,
						height: pose.heightMm,
						rotation: pose.rotation
					};
					renderingHost.element("fragment", context, fragment, () => {
						context.save();
						context.translate(pose.xMm + pose.widthMm / 2, pose.yMm + pose.heightMm / 2);
						context.rotate(pose.rotation * Math.PI / 180);
						context.drawImage(image, -pose.widthMm / 2, -pose.heightMm / 2, pose.widthMm, pose.heightMm);
						context.restore();
					});
				}
				context.restore();
				return count;
			}
			#drawControls(context, interactive) {
				if (workspace.archive.participant.collageShowBounds) for (const object of collageObjects()) {
					const pose = placement(object);
					if (!pose.hidden && (!interactive || workspace.selected?.id !== object.id)) drawItemFrame(context, pose);
				}
				if (interactive && workspace.selected?.type === "object") {
					const pose = placement(workspace.archive.objects.find((item) => item.id === workspace.selected.id));
					if (!pose.hidden) drawItemFrame(context, pose, true);
				}
			}
		}
		return new CollagePosterRenderer();
	}

//#endregion
//#region src/screenshot-archaeology/domain/collage-preparation.js
	async function prepareCollageSizing(data, assets, { pack, onStatus = () => {} }) {
		if (!data.collage || data.collage.sizeContrast === 2) return;
		if (data.participant.collageLayout || data.participant.collageSizing === "equal") return;
		if (Object.values(data.participant.collage || {}).some((edit) => [
			"xMm",
			"yMm",
			"scale",
			"rotation"
		].some((key) => Object.hasOwn(edit, key)))) return;
		const ids = new Set(data.collage.items.map((p) => p.objectId));
		const objects = (data.objects || []).filter((o) => o.kind !== "text_fragment" && ids.has(o.id));
		const weights = objects.map((o) => o.relativeAreaWeight || 1);
		if (objects.length && Math.max(...weights) > Math.min(...weights)) {
			onStatus("Arranging the collage with more size variation…");
			data.collage.items = await pack(objects, (o) => assets.get("poster:" + o.id) || assets.get(o.id));
		}
		data.collage.sizeContrast = 2;
	}

//#endregion
//#region src/screenshot-archaeology/ui/inspector.js
	function createInspectorController({ workspace, el, showMicrocosmTheme, showMicrocosmOverview, editObject, action, viewSource, typeName, colors, buildRelationFilters, renderGraph, inputLabel, inspect, addMicrocosmSourceContext }) {
		class InspectorController {
			#panel;
			constructor(panel) {
				this.#panel = panel;
			}
			show(value) {
				workspace.select(value);
				this.#panel.replaceChildren();
				if (!workspace.archive) {
					this.#panel.append(el("p", "Select a screenshot, a connection or a collage fragment.", "muted"));
					return;
				}
				if (!value) return this.#showOverview();
				if (value.type === "microcosm-theme") return showMicrocosmTheme(this.#panel, value.id);
				if (value.type === "object") return this.#showFragment(value);
				if (value.type === "relation") return this.#showRelation(value);
				this.#showSource(value);
			}
			#showOverview() {
				const panel = this.#panel;
				if (workspace.mode === "microcosm") return showMicrocosmOverview(panel);
				if (workspace.mode === "collage") panel.append(el("p", "Sizes propose a reading of repeated content. They do not measure your personal interest. Drag a fragment or select it below to change its size, angle or inclusion.", "muted"));
				else panel.append(el("p", "Select a trace or connection to inspect its source evidence and leave your own reading.", "muted"));
			}
			#showFragment(value) {
				const panel = this.#panel;
				const obj = workspace.archive.objects.find((o) => o.id === value.id), edit = workspace.archive.participant.collage[obj.id] || {};
				panel.append(el("h2", edit.label || obj.label));
				const keep = el("input");
				keep.type = "checkbox";
				keep.checked = !edit.hidden;
				const keepLabel = el("label");
				keepLabel.append(keep, document.createTextNode(" Include on poster"));
				panel.append(keepLabel);
				keep.onchange = () => editObject(obj, { hidden: !keep.checked });
				action(panel, "View original screenshot", () => viewSource(obj.sourceId, obj.bbox));
				const other = el("section");
				other.append(el("h3", "Repeated-content sources"));
				for (const id of obj.recurrence.sourceIds) action(other, workspace.archive.items.find((i) => i.id === id).filename, () => viewSource(id), true).classList.add("source-button");
				panel.append(other);
			}
			#showRelation(value) {
				const panel = this.#panel;
				const r = workspace.archive.relations.find((r) => r.id === value.id), edit = workspace.archive.participant.relations[r.id] || {};
				const relationType = el("p", typeName(r.type), "type-label");
				relationType.style.color = colors[r.type];
				panel.append(relationType, el("h2", edit.label || r.label));
				if (r.rationale) panel.append(el("p", r.rationale, "rule"));
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
					const source = workspace.archive.items.find((i) => i.id === r[side]), section = el("section"), evidence = r.evidence[side];
					section.append(el("h3", source.filename), el("blockquote", evidence.quote || evidence.description));
					action(section, "View source", () => viewSource(source.id, evidence.region));
					panel.append(section);
				}
				const row = el("div", void 0, "inline-actions");
				action(row, edit.status === "rejected" ? "Restore connection" : "Reject connection", () => {
					workspace.updateRelation(r.id, { status: edit.status === "rejected" ? "proposed" : "rejected" });
					inspect(value);
					renderGraph();
				});
				panel.append(row);
			}
			#showSource(value) {
				const panel = this.#panel;
				const source = workspace.archive.items.find((i) => i.id === value.id), obs = workspace.archive.observations.find((o) => o.id === value.id);
				panel.append(el("h2", obs.title));
				const im = el("img");
				im.src = source.preview;
				im.className = "trace-preview";
				im.alt = source.filename;
				panel.append(im, el("p", obs.summary), el("p", source.filename, "small"));
				for (const uncertainty of obs.uncertainties || []) panel.append(el("p", uncertainty, "small"));
				action(panel, "View original screenshot", () => viewSource(source.id));
				if (workspace.mode === "microcosm") addMicrocosmSourceContext(panel, source.id);
				const connected = workspace.archive.relations.filter((r) => r.source === source.id || r.target === source.id);
				const section = el("section");
				section.append(el("h3", "Connections"));
				for (const r of connected) action(section, workspace.archive.participant.relations[r.id]?.label || r.label, () => {
					inspect({
						type: "relation",
						id: r.id
					});
					renderGraph();
				}, true).classList.add("source-button");
				panel.append(section);
			}
		}
		return InspectorController;
	}

//#endregion
//#region src/screenshot-archaeology/ui/dom.js
	const $ = (id) => document.getElementById(id);
	const el = (tag, text, cls) => {
		const n = document.createElement(tag);
		if (text !== void 0) n.textContent = text;
		if (cls) n.className = cls;
		return n;
	};

//#endregion
//#region src/screenshot-archaeology/rendering/rendering-host.js
	var RenderingHost = class {
		#isLiveCanvas;
		constructor(isLiveCanvas) {
			this.#isLiveCanvas = isLiveCanvas;
		}
		#renderer = null;
		register(renderer) {
			this.#renderer = renderer;
		}
		paint(view, context, interactive, drawScene, format = "poster") {
			if (!this.#renderer) return drawScene();
			if (this.#isLiveCanvas(context.canvas) && interactive && !this.#renderer.isDrawing()) {
				this.#renderer.request();
				return;
			}
			return this.#renderer.paint(view, context, interactive, drawScene, format);
		}
		element(kind, context, model, fallback) {
			if (!this.#renderer?.element(kind, context, model)) fallback();
		}
		get layoutOptions() {
			return this.#renderer?.layoutOptions() || {};
		}
		async flush() {
			await this.#renderer?.flush();
		}
	};

//#endregion
//#region src/screenshot-archaeology/domain/archive.js
	function validateArchive(data) {
		if (!data || !["pcd.archive/2", "pcd.archive/3"].includes(data.schema) || !(data.items?.length >= 20 && data.items.length <= 30) || data.observations?.length !== data.items.length || data.pairAssessments?.length !== data.items.length * (data.items.length - 1) / 2) throw Error("Open a complete workshop archive containing 20–30 sources and every pair assessment.");
		const ids = new Set(data.items.map((i) => i.id));
		if (ids.size !== data.items.length) throw Error("Screenshot IDs are duplicated.");
		for (const item of data.items) if (!/^data:image\/(png|jpeg|webp);base64,/.test(item.preview)) throw Error("A screenshot preview is missing or unsupported.");
		for (const r of data.relations) if (!ids.has(r.source) || !ids.has(r.target) || r.source === r.target) throw Error("A relation has an invalid source.");
		if (data.schema === "pcd.archive/3") {
			if (!data.objects?.length || !data.collage?.items) throw Error("The collage data is incomplete.");
			const objectIds = new Set(data.objects.map((o) => o.id));
			const placed = data.collage.items.map((p) => p.objectId), excluded = data.collage.excludedObjectIds || [], covered = /* @__PURE__ */ new Set([...placed, ...excluded]);
			if (objectIds.size !== data.objects.length || covered.size !== objectIds.size || placed.length + excluded.length !== covered.size || [...covered].some((id) => !objectIds.has(id))) throw Error("Collage objects, placements or exclusions are duplicated/missing.");
			for (const o of data.objects) if (!ids.has(o.sourceId) || !/^data:image\/png;base64,/.test(o.asset) || !o.bbox?.every(Number.isFinite)) throw Error("An artifact has an invalid source or PNG.");
			for (const o of data.objects) if (o.posterAsset && !/^data:image\/png;base64,/.test(o.posterAsset)) throw Error("A decorative poster asset must be an embedded PNG.");
			for (const p of data.collage.items) if (!objectIds.has(p.objectId) || ![
				"xMm",
				"yMm",
				"widthMm",
				"heightMm"
			].every((k) => Number.isFinite(p[k]))) throw Error("A collage placement is invalid.");
		}
		data = {
			...data,
			participant: { ...data.participant }
		};
		for (const name of [
			"relations",
			"notes",
			"positions",
			"groups",
			"collage"
		]) data.participant[name] = { ...data.participant[name] };
		return data;
	}

//#endregion
//#region src/screenshot-archaeology/poster-template.js
	const contentBounds = Object.freeze({
		x: 7,
		y: 36,
		width: 196,
		height: 240
	});
	const LEGACY_LAYOUT = Object.freeze({
		widthMm: 190,
		heightMm: 257,
		centreXMm: 105,
		centreYMm: 158.5,
		targetCentreYMm: 156
	});
	const defaults = {
		id: "archaeology-poster-v1",
		contentBounds,
		titleFont: "Basteleur",
		titleFontWeight: 700,
		titleLetterSpacingEm: -.04,
		footerFont: "Junction"
	};
	const title = "Screenshot Archeology";
	const footerLeft = "Processing Community Day @ Boston";
	const footerRight = "Nov 1, 2026";
	function adopt(archive) {
		if (!archive.collage) return archive;
		const next = {
			...archive,
			collage: {
				...archive.collage,
				items: archive.collage.items.map((item) => ({ ...item })),
				template: archive.collage.template ? { ...archive.collage.template } : null
			},
			participant: {
				...archive.participant,
				collage: Object.fromEntries(Object.entries(archive.participant.collage || {}).map(([id, edit]) => [id, { ...edit }])),
				collageLayout: archive.participant.collageLayout?.map((item) => ({ ...item }))
			}
		};
		const layout = next.collage;
		if (!layout.template) {
			const factor = Math.min(contentBounds.width / LEGACY_LAYOUT.widthMm, contentBounds.height / LEGACY_LAYOUT.heightMm), dx = LEGACY_LAYOUT.centreXMm * (1 - factor), dy = LEGACY_LAYOUT.targetCentreYMm - LEGACY_LAYOUT.centreYMm * factor;
			const fit = (p) => {
				p.xMm = p.xMm * factor + dx;
				p.yMm = p.yMm * factor + dy;
				p.widthMm *= factor;
				p.heightMm *= factor;
			};
			layout.items.forEach(fit);
			next.participant.collageLayout?.forEach(fit);
			for (const edit of Object.values(next.participant.collage || {})) {
				if (Number.isFinite(edit.xMm)) edit.xMm = edit.xMm * factor + dx;
				if (Number.isFinite(edit.yMm)) edit.yMm = edit.yMm * factor + dy;
			}
			layout.template = structuredClone(defaults);
			if (!layout.title || layout.title === "Collected traces") layout.title = title;
		}
		layout.template.titleFontWeight ??= 700;
		layout.template.titleLetterSpacingEm ??= -.04;
		layout.footerLeft ??= footerLeft;
		layout.footerRight ??= footerRight;
		return next;
	}
	const PosterTemplate = {
		contentBounds,
		defaults,
		title,
		footerLeft,
		footerRight,
		adopt
	};

//#endregion
//#region src/screenshot-archaeology/domain/mode-data.js
	function baseBoxes$1(data) {
		return data.participant.collageLayout || data.collage.items;
	}
	function collageObjects$1(data) {
		const ids = new Set((data?.collage?.items || []).map((p) => p.objectId));
		return (data?.objects || []).filter((o) => o.kind !== "text_fragment" && ids.has(o.id));
	}
	function placement$1(data, obj) {
		const base = baseBoxes$1(data).find((p) => p.objectId === obj.id) || data.collage.items.find((p) => p.objectId === obj.id), edit = data.participant.collage[obj.id] || {};
		return {
			objectId: obj.id,
			xMm: edit.xMm ?? base.xMm,
			yMm: edit.yMm ?? base.yMm,
			widthMm: base.widthMm * (edit.scale ?? 1),
			heightMm: base.heightMm * (edit.scale ?? 1),
			rotation: edit.rotation ?? base.rotation ?? 0,
			hidden: edit.hidden === true
		};
	}
	function posterContentBounds$1(data) {
		return data?.collage?.template?.contentBounds || PosterTemplate.contentBounds;
	}
	function clampPlacement(data, obj, p) {
		p = { ...p };
		const region = posterContentBounds$1(data), rad = p.rotation * Math.PI / 180, center = {
			x: p.xMm + p.widthMm / 2,
			y: p.yMm + p.heightMm / 2
		};
		let bw = Math.abs(p.widthMm * Math.cos(rad)) + Math.abs(p.heightMm * Math.sin(rad)), bh = Math.abs(p.widthMm * Math.sin(rad)) + Math.abs(p.heightMm * Math.cos(rad));
		const fit = Math.min(1, region.width / bw, region.height / bh);
		p.widthMm *= fit;
		p.heightMm *= fit;
		bw *= fit;
		bh *= fit;
		const cx = Math.min(region.x + region.width - bw / 2, Math.max(region.x + bw / 2, center.x)), cy = Math.min(region.y + region.height - bh / 2, Math.max(region.y + bh / 2, center.y));
		p.xMm = cx - p.widthMm / 2;
		p.yMm = cy - p.heightMm / 2;
		return p;
	}
	function relationLabel$1(data, relation) {
		return data.participant.relations[relation.id]?.label?.trim() || relation.label;
	}
	function relationKey$1(data, relation) {
		return relation.type + "|" + relationLabel$1(data, relation).trim().toLocaleLowerCase();
	}
	function visibleRelations$1(data, enabledRelationLabels) {
		return data.relations.filter((r) => data.participant.relations[r.id]?.status !== "rejected" && enabledRelationLabels.has(relationKey$1(data, r)));
	}

//#endregion
//#region src/screenshot-archaeology/domain/theme-labels.js
	const keyFor = (ids) => [...ids].sort().join("|");
	/** Resolve only summaries for the exact current membership and lens/count. */
	function themeLabels(data, lens, count, memberships, fallback) {
		const saved = data.microcosm?.themeSummaries?.[lens]?.[String(count)] || [];
		const byMembers = new Map(saved.map((theme) => [keyFor(theme.itemIds || []), theme]));
		return memberships.map((ids, index) => {
			const theme = byMembers.get(keyFor(ids));
			const support = theme?.supportingIds || [];
			if (!(theme && typeof theme.label === "string" && theme.label.trim() && theme.label.length <= 70 && typeof theme.summary === "string" && theme.summary.trim() && support.length && new Set(support).size === support.length && support.every((id) => ids.includes(id)) && (theme.mixed || support.length >= Math.floor(ids.length / 2) + 1))) return {
				...fallback[index],
				summarySource: "descriptors"
			};
			return {
				...fallback[index],
				label: theme.label.trim(),
				summary: theme.summary.trim(),
				supportingIds: [...support],
				mixed: theme.mixed === true,
				summarySource: "cluster-summary"
			};
		});
	}

//#endregion
//#region src/screenshot-archaeology/domain/microcosm-policy.js
	const MICROCOSM_BOUNDS = Object.freeze({
		x: 13,
		y: 48,
		w: 271,
		h: 143
	});
	const MOTION = Object.freeze({
		maximumTimeStep: .05,
		attraction: .035,
		alignmentRadius: 32,
		collisionGap: 2,
		maximumRepulsion: 12,
		repulsion: 2,
		alignment: .2,
		radialThreshold: .72,
		radialForce: 1.4,
		horizontalFrequency: .45,
		verticalFrequency: .38,
		drift: .45,
		maximumSpeed: 3.2,
		minimumSpeed: .45,
		boundaryPadding: 1,
		bounce: -.6
	});

//#endregion
//#region src/screenshot-archaeology/domain/microcosm-motion.js
	const clamp$2 = (value, min, max) => Math.max(min, Math.min(max, value));
	const caches = /* @__PURE__ */ new WeakMap();
	function frameCache(state) {
		const cached = caches.get(state);
		if (cached?.nodes === state.nodes && cached.groupSource === state.groups) return cached;
		const next = {
			nodes: state.nodes,
			groupSource: state.groups,
			groups: new Map(state.groups.map((group) => [group.id, group])),
			accelerations: state.nodes.map(() => ({
				ax: 0,
				ay: 0
			}))
		};
		caches.set(state, next);
		return next;
	}
	function step(state, elapsed) {
		const dt = clamp$2(elapsed || 0, 0, MOTION.maximumTimeStep);
		state.time += dt;
		const cache = frameCache(state);
		const accelerations = cache.accelerations;
		state.nodes.forEach((a, index) => {
			const group = cache.groups.get(a.groupId);
			let ax = (group.x - a.x) * MOTION.attraction, ay = (group.y - a.y) * MOTION.attraction, neighbours = 0, vx = 0, vy = 0;
			for (const b of state.nodes) {
				if (a === b) continue;
				const dx = a.x - b.x, dy = a.y - b.y, distance = Math.hypot(dx, dy);
				if (a.groupId === b.groupId && distance < MOTION.alignmentRadius) {
					vx += b.vx;
					vy += b.vy;
					neighbours++;
				}
				const ox = (a.w + b.w) / 2 + MOTION.collisionGap - Math.abs(dx), oy = (a.h + b.h) / 2 + MOTION.collisionGap - Math.abs(dy);
				if (ox > 0 && oy > 0) {
					if (ox < oy) ax += (dx < 0 ? -1 : 1) * Math.min(MOTION.maximumRepulsion, ox * MOTION.repulsion);
					else ay += (dy < 0 ? -1 : 1) * Math.min(MOTION.maximumRepulsion, oy * MOTION.repulsion);
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
			const speed = Math.hypot(node.vx, node.vy), factor = speed > MOTION.maximumSpeed ? MOTION.maximumSpeed / speed : speed < MOTION.minimumSpeed ? MOTION.minimumSpeed / (speed || 1) : 1;
			node.vx *= factor;
			node.vy *= factor;
			node.x += node.vx * dt;
			node.y += node.vy * dt;
			const pad = Math.hypot(node.w, node.h) / 2 + MOTION.boundaryPadding;
			const x = clamp$2(node.x, MICROCOSM_BOUNDS.x + pad, MICROCOSM_BOUNDS.x + MICROCOSM_BOUNDS.w - pad), y = clamp$2(node.y, MICROCOSM_BOUNDS.y + pad, MICROCOSM_BOUNDS.y + MICROCOSM_BOUNDS.h - pad);
			if (x !== node.x) node.vx *= MOTION.bounce;
			if (y !== node.y) node.vy *= MOTION.bounce;
			node.x = x;
			node.y = y;
		});
	}

//#endregion
//#region src/screenshot-archaeology/microcosm-model.js
	const clamp$1 = (v, a, b) => Math.max(a, Math.min(b, v));
	/** Suggested exploration count; it is not an estimated number of natural classes. */
	function defaultThemeCount(data) {
		const detailFactor = data.microcosm ? 1.3 : 1;
		return Math.min(8, Math.max(3, Math.round(Math.sqrt(data.items.length) * detailFactor)));
	}
	function hash(value) {
		let n = 2166136261;
		for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
		return (n >>> 0) / 4294967296;
	}
	function cosine(a, b) {
		let dot = 0, aa = 0, bb = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
			aa += a[i] ** 2;
			bb += b[i] ** 2;
		}
		return aa && bb ? clamp$1(dot / Math.sqrt(aa * bb), -1, 1) : 0;
	}
	function averageDistance(left, right, distances) {
		let sum = 0;
		left.forEach((a) => right.forEach((b) => {
			sum += distances[a][b];
		}));
		return sum / (left.length * right.length);
	}
	function cluster(ids, vectors, count, compact = false) {
		const distances = ids.map((a) => ids.map((b) => 1 - cosine(vectors[a], vectors[b])));
		const groups = ids.map((_, i) => [i]);
		while (groups.length > count) {
			let best = Infinity, pair = null;
			const capacity = compact ? Math.ceil(ids.length / count * 1.6) : Infinity;
			for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
				if (groups[i].length + groups[j].length > capacity) continue;
				const distance = averageDistance(groups[i], groups[j], distances);
				if (distance < best - 1e-12) {
					best = distance;
					pair = [i, j];
				}
			}
			if (!pair) return cluster(ids, vectors, count, false);
			groups[pair[0]].push(...groups[pair[1]]);
			groups.splice(pair[1], 1);
		}
		return groups.map((g) => g.map((i) => ids[i]).sort());
	}
	function keywordLabels(groups, observations, total) {
		const global = /* @__PURE__ */ new Map();
		for (const obs of observations.values()) for (const term of new Set(obs.keywords || [])) global.set(term.toLowerCase(), (global.get(term.toLowerCase()) || 0) + 1);
		const used = /* @__PURE__ */ new Map();
		return groups.map((ids) => {
			const local = /* @__PURE__ */ new Map(), original = /* @__PURE__ */ new Map();
			for (const id of ids) for (const term of new Set(observations.get(id)?.keywords || [])) {
				const key = term.toLowerCase().trim();
				if (!key || /^(image|text|post|screenshot|content|book)$/.test(key)) continue;
				local.set(key, (local.get(key) || 0) + 1);
				original.set(key, term);
			}
			const terms = [...local.keys()].sort((a, b) => local.get(b) * Math.log(1 + total / global.get(b)) - local.get(a) * Math.log(1 + total / global.get(a)) || a.localeCompare(b));
			const label = terms.length ? terms.slice(0, 2).map((t) => original.get(t)).join(" / ") : "Unclassified sources";
			const repeat = (used.get(label) || 0) + 1;
			used.set(label, repeat);
			return {
				label: repeat === 1 ? label : `${label} · ${repeat}`,
				keywords: terms.slice(0, 3).map((t) => original.get(t))
			};
		});
	}
	function build(data, { count = Math.min(6, Math.max(3, Math.round(Math.sqrt(data.items.length)))), snapshot: saved = null, lens = "combined", projectionMode = "umap" } = {}) {
		const detailed = data.microcosm?.lenses?.[lens];
		if (detailed) {
			const details = new Map(data.microcosm.items.map((o) => [o.id, o]));
			data = {
				...data,
				embeddings: {
					...data.embeddings,
					fused: { vectors: detailed.vectors }
				},
				projections: {
					fused_pca: detailed.projections.pca,
					fused_umap: detailed.projections.umap
				},
				observations: data.observations.map((o) => ({
					...o,
					keywords: (lens === "combined" ? [...details.get(o.id)?.content || [], ...details.get(o.id)?.visual || []] : details.get(o.id)?.[lens] || []).map((e) => e.label)
				}))
			};
		}
		const ids = data.items.map((o) => o.id).sort(), items = new Map(data.items.map((o) => [o.id, o]));
		const vectors = data.embeddings?.fused?.vectors || {};
		const dims = vectors[ids[0]]?.length;
		const valid = dims > 0 && ids.every((id) => Array.isArray(vectors[id]) && vectors[id].length === dims && vectors[id].every(Number.isFinite) && vectors[id].some((v) => v !== 0));
		count = clamp$1(Math.round(count) || 1, 1, ids.length);
		let memberships;
		if (valid) memberships = cluster(ids, vectors, count, !!detailed);
		else {
			const assigned = /* @__PURE__ */ new Set();
			memberships = [];
			for (const group of data.groups || []) {
				const members = (group.itemIds || []).filter((id) => items.has(id) && !assigned.has(id));
				members.forEach((id) => assigned.add(id));
				if (members.length) memberships.push(members);
			}
			const rest = ids.filter((id) => !assigned.has(id));
			if (rest.length) memberships.push(rest);
		}
		const observations = new Map((data.observations || []).map((o) => [o.id, o]));
		const labels = themeLabels(data, lens, count, memberships, keywordLabels(memberships, observations, ids.length));
		let projection = projectionMode !== "pca" && data.projections?.fused_umap?.coordinates ? "UMAP" : data.projections?.fused_pca?.coordinates ? "PCA" : "Display arrangement";
		const coordinates = (projection === "UMAP" ? data.projections.fused_umap.coordinates : data.projections?.fused_pca?.coordinates) || {};
		const points = ids.map((id, i) => coordinates[id]?.length === 2 && coordinates[id].every(Number.isFinite) ? coordinates[id] : [Math.cos(i * 2.399), Math.sin(i * 2.399)]);
		if (!ids.every((id) => coordinates[id]?.length === 2 && coordinates[id].every(Number.isFinite))) projection = "Display arrangement";
		const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
		const minX = Math.min(...xs), minY = Math.min(...ys), dx = Math.max(...xs) - minX || 1, dy = Math.max(...ys) - minY || 1;
		const positions = new Map(ids.map((id, i) => [id, {
			x: MICROCOSM_BOUNDS.x + 32 + (points[i][0] - minX) / dx * (MICROCOSM_BOUNDS.w - 64),
			y: MICROCOSM_BOUNDS.y + 25 + (points[i][1] - minY) / dy * (MICROCOSM_BOUNDS.h - 50)
		}]));
		const groups = memberships.map((itemIds, i) => ({
			id: "theme-" + Math.round(hash(itemIds.join("|")) * 1e9).toString(36),
			itemIds,
			...labels[i],
			colorIndex: i,
			x: itemIds.reduce((s, id) => s + positions.get(id).x, 0) / itemIds.length,
			y: itemIds.reduce((s, id) => s + positions.get(id).y, 0) / itemIds.length,
			rx: 17 + Math.sqrt(itemIds.length) * 9,
			ry: 12 + Math.sqrt(itemIds.length) * 6
		}));
		for (let pass = 0; pass < 160; pass++) {
			for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
				const a = groups[i], b = groups[j], vx = b.x - a.x, vy = b.y - a.y;
				const distance = Math.hypot(vx / (a.rx + b.rx + 5), vy / (a.ry + b.ry + 7));
				if (distance < 1) {
					const angle = Math.atan2(vy, vx) || (i + j + 1) * 2.399, push = (1 - distance) * 2;
					a.x -= Math.cos(angle) * push;
					a.y -= Math.sin(angle) * push;
					b.x += Math.cos(angle) * push;
					b.y += Math.sin(angle) * push;
				}
			}
			for (const g of groups) {
				g.x = clamp$1(g.x, MICROCOSM_BOUNDS.x + g.rx, MICROCOSM_BOUNDS.x + MICROCOSM_BOUNDS.w - g.rx);
				g.y = clamp$1(g.y, MICROCOSM_BOUNDS.y + g.ry + 4, MICROCOSM_BOUNDS.y + MICROCOSM_BOUNDS.h - g.ry);
			}
		}
		const nodes = [];
		for (const group of groups) group.itemIds.forEach((id, i) => {
			const item = items.get(id), size = Math.min(18 / item.width, 15 / item.height), angle = i * 2.399 + hash(group.id) * 6.28;
			const radius = Math.sqrt((i + .5) / group.itemIds.length) * .68;
			const velocity = hash(id + "velocity") * 6.28;
			const centre = {
				x: group.itemIds.reduce((v, k) => v + positions.get(k).x, 0) / group.itemIds.length,
				y: group.itemIds.reduce((v, k) => v + positions.get(k).y, 0) / group.itemIds.length
			};
			const extent = Math.max(1, ...group.itemIds.map((k) => Math.hypot(positions.get(k).x - centre.x, positions.get(k).y - centre.y)));
			const point = positions.get(id);
			const localX = group.itemIds.length > 1 ? (point.x - centre.x) / extent * .7 : Math.cos(angle) * radius;
			const localY = group.itemIds.length > 1 ? (point.y - centre.y) / extent * .7 : Math.sin(angle) * radius;
			nodes.push({
				id,
				groupId: group.id,
				x: group.x + localX * group.rx,
				y: group.y + localY * group.ry,
				w: item.width * size,
				h: item.height * size,
				vx: Math.cos(velocity) * 1.2,
				vy: Math.sin(velocity) * 1.2,
				phase: hash(id) * 6.28
			});
		});
		const state = {
			datasetId: data.datasetId,
			lens,
			detailed: !!detailed,
			groups,
			nodes,
			bounds: { ...MICROCOSM_BOUNDS },
			vectors: valid ? vectors : {},
			count,
			projection,
			method: valid ? `Average linkage${detailed ? " with group size limit" : ""} · ${detailed ? lens + " detailed features" : "legacy image + text features"}` : "Saved groups / unclassified sources; feature clustering unavailable",
			time: 0
		};
		if (saved?.datasetId === data.datasetId && saved.count === count && Object.keys(saved.positions || {}).length === nodes.length && nodes.every((n) => {
			const p = saved.positions[n.id];
			return p && [
				"x",
				"y",
				"vx",
				"vy"
			].every((k) => Number.isFinite(p[k])) && p.x >= MICROCOSM_BOUNDS.x + n.w / 2 && p.x <= MICROCOSM_BOUNDS.x + MICROCOSM_BOUNDS.w - n.w / 2 && p.y >= MICROCOSM_BOUNDS.y + n.h / 2 && p.y <= MICROCOSM_BOUNDS.y + MICROCOSM_BOUNDS.h - n.h / 2;
		})) {
			for (const node of nodes) Object.assign(node, saved.positions[node.id]);
			state.time = Number.isFinite(saved.time) ? saved.time : 0;
		}
		return state;
	}
	function snapshot(state) {
		return {
			datasetId: state.datasetId,
			count: state.count,
			time: state.time,
			positions: Object.fromEntries(state.nodes.map((n) => [n.id, {
				x: n.x,
				y: n.y,
				vx: n.vx,
				vy: n.vy
			}]))
		};
	}
	function nearest(state, id, count = 2) {
		const a = state.vectors[id];
		if (!a) return [];
		return state.nodes.filter((n) => n.id !== id && state.vectors[n.id]).map((n) => ({
			id: n.id,
			similarity: cosine(a, state.vectors[n.id])
		})).sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id)).slice(0, count);
	}
	function hull(points) {
		const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
		if (sorted.length < 3) return sorted;
		const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lower = [], upper = [];
		for (const p of sorted) {
			while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
			lower.push(p);
		}
		for (const p of sorted.slice().reverse()) {
			while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
			upper.push(p);
		}
		return lower.slice(0, -1).concat(upper.slice(0, -1));
	}
	const Microcosm = Object.freeze({
		build,
		step,
		snapshot,
		nearest,
		hull,
		defaultThemeCount
	});

//#endregion
//#region src/screenshot-archaeology/domain/workspace.js
	const TRANSFORM_FIELDS = [
		"xMm",
		"yMm",
		"scale",
		"rotation"
	];
	/** Application state and editing commands. No DOM, canvas or p5 dependency. */
	var Workspace = class {
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
			if (settings.footerLeft != null) participant.collageFooterLeft = settings.footerLeft;
			if (settings.footerRight != null) participant.collageFooterRight = settings.footerRight;
			return {
				...data,
				participant
			};
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
			if (revision !== this.#loadRevision) return null;
			await prepareSizing({
				data,
				assets
			});
			if (revision !== this.#loadRevision) return null;
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
				if (![
					"xMm",
					"yMm",
					"widthMm",
					"heightMm"
				].some((key) => Math.abs(original[key] - bounded[key]) > 1e-4)) return;
				const base = this.baseBoxes().find((item) => item.objectId === obj.id);
				this.updateFragment(obj.id, {
					xMm: bounded.xMm,
					yMm: bounded.yMm,
					scale: bounded.widthMm / base.widthMm
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
		enabledRelationLabels = /* @__PURE__ */ new Set();
		microcosmState = null;
		microcosmKey = "";
		invalidateMicrocosm() {
			this.microcosmKey = "";
		}
		baseBoxes() {
			return baseBoxes$1(this.archive);
		}
		collageObjects() {
			return collageObjects$1(this.archive);
		}
		placement(obj) {
			return placement$1(this.archive, obj);
		}
		posterContentBounds() {
			return posterContentBounds$1(this.archive);
		}
		clampPlacement(obj, placement) {
			return clampPlacement(this.archive, obj, placement);
		}
		relationLabel(relation) {
			return relationLabel$1(this.archive, relation);
		}
		relationKey(relation) {
			return relationKey$1(this.archive, relation);
		}
		visibleRelations() {
			return visibleRelations$1(this.archive, this.enabledRelationLabels);
		}
		#relationKeys = /* @__PURE__ */ new Set();
		relationGroups(reset = false) {
			const groups = /* @__PURE__ */ new Map();
			this.archive.relations.forEach((relation) => {
				const key = this.relationKey(relation);
				if (!groups.has(key)) groups.set(key, {
					label: this.relationLabel(relation),
					type: relation.type
				});
			});
			if (reset) this.enabledRelationLabels.clear();
			groups.forEach((_, key) => {
				if (reset || !this.#relationKeys.has(key)) this.setRelationEnabled(key, true);
			});
			this.#relationKeys = new Set(groups.keys());
			return groups;
		}
		setRelationEnabled(key, enabled) {
			if (enabled) this.enabledRelationLabels.add(key);
			else this.enabledRelationLabels.delete(key);
		}
		updateParticipant(changes) {
			this.archive.participant = {
				...this.archive.participant,
				...changes
			};
		}
		updateRelation(id, changes) {
			const relations = this.archive.participant.relations;
			this.updateParticipant({ relations: {
				...relations,
				[id]: {
					...relations[id],
					...changes
				}
			} });
		}
		updateFragment(id, changes) {
			const collage = this.archive.participant.collage;
			this.updateParticipant({ collage: {
				...collage,
				[id]: {
					...collage[id],
					...changes
				}
			} });
		}
		editObject(obj, changes) {
			this.updateFragment(obj.id, changes);
			const placement = this.clampPlacement(obj, this.placement(obj));
			const base = this.baseBoxes().find((item) => item.objectId === obj.id);
			this.updateFragment(obj.id, {
				scale: placement.widthMm / base.widthMm,
				xMm: placement.xMm,
				yMm: placement.yMm
			});
			return placement;
		}
		clearFragmentTransforms(includeHidden = false) {
			const fields = includeHidden ? [...TRANSFORM_FIELDS, "hidden"] : TRANSFORM_FIELDS;
			const collage = Object.fromEntries(Object.entries(this.archive.participant.collage).map(([id, edit]) => [id, Object.fromEntries(Object.entries(edit).filter(([key]) => !fields.includes(key)))]));
			this.updateParticipant({ collage });
		}
		applyCollageLayout(placed, visible, equal) {
			const hidden = this.archive.collage.items.filter((item) => !visible.some((obj) => obj.id === item.objectId));
			this.updateParticipant({
				collageLayout: placed.concat(hidden),
				collageSizing: equal ? "equal" : "recurrence"
			});
			this.clearFragmentTransforms();
		}
		resetCollage() {
			const participant = Object.fromEntries(Object.entries(this.archive.participant).filter(([key]) => !["collageLayout", "collageSizing"].includes(key)));
			this.archive.participant = participant;
			this.clearFragmentTransforms(true);
		}
		advanceMicrocosm(elapsed) {
			Microcosm.step(this.prepareMicrocosm(), elapsed);
		}
		prepareMicrocosm() {
			if (!this.archive) return null;
			const saved = this.archive.participant.microcosm || {};
			const count = Number(saved.count) || Microcosm.defaultThemeCount(this.archive);
			const lens = saved.lens || "combined";
			const projectionMode = "umap";
			const key = this.archive.datasetId + ":" + count + ":" + lens + ":umap";
			if (this.microcosmKey !== key || !this.microcosmState) {
				this.microcosmState = Microcosm.build(this.archive, {
					count,
					lens,
					projectionMode,
					snapshot: saved.snapshot
				});
				this.microcosmKey = key;
			}
			return this.microcosmState;
		}
	};

//#endregion
//#region src/screenshot-archaeology/infrastructure/image-assets.js
/** Browser-only image decoding; the application receives this as an adapter. */
	async function loadImageAssets(data) {
		const pending = /* @__PURE__ */ new Map();
		const entries = data.items.map((item) => [item.id, item.preview]).concat((data.objects || []).map((item) => [item.id, item.asset]), (data.objects || []).filter((item) => item.posterAsset).map((item) => ["poster:" + item.id, item.posterAsset]));
		await Promise.all(entries.map(([id, src]) => new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => {
				pending.set(id, image);
				resolve();
			};
			image.onerror = () => reject(Error("An image in this JSON could not be loaded."));
			image.src = src;
		})));
		return pending;
	}

//#endregion
//#region src/screenshot-archaeology/graph-layout.js
	function shortLabel(value, limit = 28) {
		const chars = Array.from(String(value).replace(/\s+/g, " ").trim().replace(/^(?:the\s+)?(?:post|screenshot|image)\s+(?:shows|features|includes|discusses)\s+/i, ""));
		return chars.length <= limit ? chars.join("") : chars.slice(0, Math.max(0, limit - 1)).join("").trimEnd() + "…";
	}
	function spreadNodes(points, gap) {
		const out = points.map((p) => ({ ...p }));
		for (let step = 0; step < 600; step++) {
			let overlap = 0;
			for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
				const a = out[i], b = out[j], dx = b.x - a.x, dy = b.y - a.y;
				const ox = (a.w + b.w) / 2 + gap - Math.abs(dx), oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
				if (ox <= 0 || oy <= 0) continue;
				overlap = Math.max(overlap, Math.min(ox, oy));
				if (ox < oy) {
					const move = (ox + .05) / 2 * (dx < 0 ? -1 : 1);
					a.x -= move;
					b.x += move;
				} else {
					const move = (oy + .05) / 2 * (dy < 0 ? -1 : 1);
					a.y -= move;
					b.y += move;
				}
			}
			if (overlap < .1) break;
		}
		return out;
	}
	function edgeSegment(a, b, lane = 0) {
		const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
		if (length < 1) return null;
		const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
		lane = Math.max(-Math.min(a.w, a.h, b.w, b.h) * .35, Math.min(Math.min(a.w, a.h, b.w, b.h) * .35, lane));
		const exit = (p, vx, vy) => Math.min(Math.abs(vx) < 1e-9 ? Infinity : (p.w / 2 - Math.sign(vx) * nx * lane) / Math.abs(vx), Math.abs(vy) < 1e-9 ? Infinity : (p.h / 2 - Math.sign(vy) * ny * lane) / Math.abs(vy));
		const start = exit(a, ux, uy) + 7, end = exit(b, -ux, -uy) + 7;
		if (start + end >= length - 4) return null;
		let angle = Math.atan2(dy, dx);
		if (angle > Math.PI / 2) angle -= Math.PI;
		if (angle < -Math.PI / 2) angle += Math.PI;
		return {
			x1: a.x + nx * lane + ux * start,
			y1: a.y + ny * lane + uy * start,
			x2: b.x + nx * lane - ux * end,
			y2: b.y + ny * lane - uy * end,
			angle
		};
	}
	function rectPolygon(r) {
		return [
			{
				x: r.x,
				y: r.y
			},
			{
				x: r.x + r.w,
				y: r.y
			},
			{
				x: r.x + r.w,
				y: r.y + r.h
			},
			{
				x: r.x,
				y: r.y + r.h
			}
		];
	}
	function labelBox(edge, width, height, t) {
		const x = edge.x1 + (edge.x2 - edge.x1) * t, y = edge.y1 + (edge.y2 - edge.y1) * t, c = Math.cos(edge.angle), s = Math.sin(edge.angle);
		const corners = rectPolygon({
			x: -width / 2 - 4,
			y: -height - 8,
			w: width + 8,
			h: height + 4
		}).map((p) => ({
			x: x + p.x * c - p.y * s,
			y: y + p.x * s + p.y * c
		}));
		return {
			x,
			y,
			angle: edge.angle,
			width,
			height,
			corners
		};
	}
	function polygonsOverlap(a, b) {
		for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
			const p = poly[i], q = poly[(i + 1) % poly.length], axis = {
				x: -(q.y - p.y),
				y: q.x - p.x
			};
			const aa = a.map((v) => v.x * axis.x + v.y * axis.y), bb = b.map((v) => v.x * axis.x + v.y * axis.y);
			if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) return false;
		}
		return true;
	}
	function findLabel(edge, width, height, obstacles, viewport) {
		for (const t of [
			.5,
			.35,
			.65,
			.22,
			.78
		]) {
			const box = labelBox(edge, width, height, t);
			if (box.corners.some((p) => p.x < 4 || p.y < 4 || p.x > viewport.w - 4 || p.y > viewport.h - 4)) continue;
			if (!obstacles.some((poly) => polygonsOverlap(poly, box.corners))) return box;
		}
		return null;
	}
	const TraceGraph = {
		shortLabel,
		spreadNodes,
		edgeSegment,
		rectPolygon,
		labelBox,
		polygonsOverlap,
		findLabel
	};

//#endregion
//#region src/screenshot-archaeology/constellation-poster.js
	const page = {
		width: 297,
		height: 210
	};
	const area = {
		x: 8,
		y: 64,
		w: 281,
		h: 131
	};
	const polygon = (r) => [
		{
			x: r.x,
			y: r.y
		},
		{
			x: r.x + r.w,
			y: r.y
		},
		{
			x: r.x + r.w,
			y: r.y + r.h
		},
		{
			x: r.x,
			y: r.y + r.h
		}
	];
	function overlaps(a, b) {
		for (const p of [a, b]) for (let i = 0; i < p.length; i++) {
			const u = p[i], v = p[(i + 1) % p.length], ax = -(v.y - u.y), ay = v.x - u.x;
			const aa = a.map((q) => q.x * ax + q.y * ay), bb = b.map((q) => q.x * ax + q.y * ay);
			if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) return false;
		}
		return true;
	}
	function wrap(text, maxWidth, measure) {
		const words = String(text).trim().split(/\s+/), lines = [];
		let line = "";
		for (const word of words) if (measure(word) > maxWidth) {
			if (line) lines.push(line);
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
		} else line += (line ? " " : "") + word;
		if (line) lines.push(line);
		return lines;
	}
	function legend(groups, measure) {
		const columns = 4, rows = Math.max(1, Math.ceil(groups.length / columns)), height = 8 * rows, cellWidth = area.w / columns;
		return {
			cells: groups.map((g, i) => {
				let size = 3;
				while (size > 2.1 && measure(g.label, size) > cellWidth - 4) size -= .05;
				const lines = wrap(g.label, cellWidth - 4, (t) => measure(t, size));
				return {
					...g,
					x: area.x + i % columns * cellWidth,
					y: 24 + Math.floor(i / columns) * 8,
					w: cellWidth,
					h: 8,
					size,
					lines
				};
			}),
			x: area.x,
			y: 24,
			w: area.w,
			h: height,
			columns,
			rows
		};
	}
	function layout(items, relations, coordinates, measure, legendBottom = 56, options = {}) {
		const bounds = {
			...area,
			y: Math.max(area.y, legendBottom + 7)
		};
		bounds.h = 195 - bounds.y;
		const values = items.map((item, i) => coordinates[item.id] || [Math.cos(i * 2.399) * Math.sqrt(i + 1), Math.sin(i * 2.399) * Math.sqrt(i + 1)]);
		const xs = values.map((p) => p[0]), ys = values.map((p) => p[1]), minX = Math.min(...xs), minY = Math.min(...ys), rangeX = Math.max(...xs) - minX || 1, rangeY = Math.max(...ys) - minY || 1;
		const nodes = items.map((item, i) => {
			const h = 16 * (options.thumbnailScale || 1), w = Math.min(20 * (options.thumbnailScale || 1), h * item.width / item.height);
			return {
				id: item.id,
				x: bounds.x + 12 + (values[i][0] - minX) / rangeX * (bounds.w - 24),
				y: bounds.y + 12 + (values[i][1] - minY) / rangeY * (bounds.h - 24),
				w,
				h
			};
		});
		const clamp = (n) => {
			n.x = Math.max(bounds.x + n.w / 2, Math.min(bounds.x + bounds.w - n.w / 2, n.x));
			n.y = Math.max(bounds.y + n.h / 2, Math.min(195 - n.h / 2, n.y));
		};
		for (let pass = 0; pass < 1e3; pass++) {
			let changed = false;
			for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
				const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, ox = (a.w + b.w) / 2 + 4 - Math.abs(dx), oy = (a.h + b.h) / 2 + 4 - Math.abs(dy);
				if (ox <= 0 || oy <= 0) continue;
				changed = true;
				if (ox < oy) {
					const push = (ox + .02) / 2 * (dx < 0 ? -1 : 1);
					a.x -= push;
					b.x += push;
				} else {
					const push = (oy + .02) / 2 * (dy < 0 ? -1 : 1);
					a.y -= push;
					b.y += push;
				}
				clamp(a);
				clamp(b);
			}
			if (!changed) break;
		}
		const map = new Map(nodes.map((n) => [n.id, n]));
		const obstacles = nodes.map((n) => polygon({
			x: n.x - n.w / 2 - 1,
			y: n.y - n.h / 2 - 1,
			w: n.w + 2,
			h: n.h + 2
		}));
		const labels = [], edges = [], unplaced = [];
		function candidate(x, y, angle, lines, size) {
			const w = Math.max(...lines.map((t) => measure(t, size))) + 2, h = lines.length * size * 1.18 + 1.4, c = Math.cos(angle), s = Math.sin(angle);
			return {
				x,
				y,
				angle,
				lines,
				size,
				w,
				h,
				corners: polygon({
					x: -w / 2,
					y: -h - .8,
					w,
					h
				}).map((p) => ({
					x: x + p.x * c - p.y * s,
					y: y + p.x * s + p.y * c
				}))
			};
		}
		function clear(box) {
			return box.corners.every((p) => p.x >= bounds.x && p.x <= bounds.x + bounds.w && p.y >= bounds.y && p.y <= 195) && !obstacles.some((p) => overlaps(p, box.corners));
		}
		function endpoint(a, b) {
			const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, k = Math.min(Math.abs(dx) < 1e-8 ? Infinity : a.w / 2 / Math.abs(dx), Math.abs(dy) < 1e-8 ? Infinity : a.h / 2 / Math.abs(dy)) + 1 / l;
			return {
				x: a.x + dx * k,
				y: a.y + dy * k
			};
		}
		function findAlongLine(lines, size, start, end, angle) {
			for (const offset of [
				0,
				4,
				-4,
				8,
				-8,
				13,
				-13,
				19,
				-19,
				26,
				-26
			]) for (const t of [
				.5,
				.35,
				.65,
				.22,
				.78
			]) {
				const anchor = {
					x: start.x + (end.x - start.x) * t,
					y: start.y + (end.y - start.y) * t
				};
				const box = candidate(anchor.x - Math.sin(angle) * offset, anchor.y + Math.cos(angle) * offset, angle, lines, size);
				if (clear(box)) return {
					...box,
					leader: offset ? anchor : null
				};
			}
			return null;
		}
		function findRelationLabel(label, length, start, end, angle) {
			const options = [
				2.8,
				2.65,
				2.5
			].flatMap((size) => [Math.min(62, Math.max(27, length - 3)), 49].map((width) => ({
				size,
				width
			})));
			for (const { size, width } of options) {
				const lines = wrap(label, width, (text) => measure(text, size));
				if (lines.length > 2) continue;
				const box = findAlongLine(lines, size, start, end, angle);
				if (box) return box;
			}
			return null;
		}
		function findFallbackLabel(relation, start, end) {
			const candidates = [], lines = wrap(relation.label, 49, (t) => measure(t, 2.5));
			for (let y = bounds.y + 8; y < 194; y += 4) for (let x = bounds.x + 27; x < bounds.x + bounds.w - 25; x += 4) {
				const c = candidate(x, y, 0, lines, 2.5);
				if (!clear(c)) continue;
				const dx = end.x - start.x, dy = end.y - start.y, t = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy || 1))), anchor = {
					x: start.x + dx * t,
					y: start.y + dy * t
				};
				candidates.push({
					...c,
					leader: anchor,
					cost: Math.hypot(x - anchor.x, y - anchor.y)
				});
			}
			return candidates.sort((a, b) => a.cost - b.cost)[0];
		}
		const ordered = [...relations].sort((a, b) => b.label.length - a.label.length);
		for (const relation of ordered) {
			const a = map.get(relation.source), b = map.get(relation.target), start = endpoint(a, b), end = endpoint(b, a), length = Math.hypot(end.x - start.x, end.y - start.y);
			let angle = Math.atan2(end.y - start.y, end.x - start.x);
			if (angle > Math.PI / 2) angle -= Math.PI;
			if (angle < -Math.PI / 2) angle += Math.PI;
			const points = [start, end];
			let box = findRelationLabel(relation.label, length, start, end, angle);
			if (!box) box = findFallbackLabel(relation, start, end);
			if (box) {
				obstacles.push(box.corners);
				labels.push({
					...box,
					text: relation.label,
					relation
				});
			} else unplaced.push(relation.id);
			edges.push({
				relation,
				points
			});
		}
		return {
			nodes,
			labels,
			edges,
			unplaced,
			bounds
		};
	}
	const ConstellationPoster = {
		page,
		area,
		wrap,
		legend,
		layout,
		polygon,
		overlaps
	};

//#endregion
//#region src/screenshot-archaeology/packing-policy.js
/** Existing packing policy; names expose units without changing its values. */
	const PACKING = Object.freeze({
		cellSizeMm: 1.25,
		samplingSizePx: 96,
		minimumAlpha: 8,
		minimumCoverage: .05,
		rasterPaddingPx: 2,
		weightExponent: 2,
		scaleUpperBound: 1.15,
		searchAttempts: 10,
		yieldEveryItems: 8,
		anglePenalty: .012,
		horizontalPenalty: .002
	});
	const ROTATION_ANGLES = Object.freeze([
		0,
		-12,
		12,
		-24,
		24,
		90,
		-90,
		180
	]);
	const BITS_PER_WORD = 32;
	const WORD_SHIFT = Math.log2(32);
	const RGBA = Object.freeze({
		channels: 4,
		alpha: 3
	});
	const DILATION_OFFSETS = Object.freeze([
		-1,
		0,
		1
	].flatMap((dy) => [
		-1,
		0,
		1
	].map((dx) => Object.freeze({
		dx,
		dy
	}))));

//#endregion
//#region src/screenshot-archaeology/silhouette-raster.js
/** Rasterize original image alpha into compact, shifted collision masks. */
	const createCanvas = () => document.createElement("canvas");
	function createSurface(width, height, factory = createCanvas) {
		const canvas = factory();
		canvas.width = width;
		canvas.height = height;
		return {
			canvas,
			context: canvas.getContext("2d", { willReadFrequently: true })
		};
	}
	function alphaCoverage(image, factory = createCanvas) {
		const size = PACKING.samplingSizePx;
		const { context } = createSurface(size, size, factory);
		context.drawImage(image, 0, 0, size, size);
		const pixels = context.getImageData(0, 0, size, size).data;
		let opaquePixels = 0;
		for (let index = RGBA.alpha; index < pixels.length; index += RGBA.channels) if (pixels[index] > PACKING.minimumAlpha) opaquePixels += 1;
		return Math.max(PACKING.minimumCoverage, opaquePixels / (size * size));
	}
	function markNeighbors(mask, width, height, x, y) {
		DILATION_OFFSETS.forEach(({ dx, dy }) => {
			const column = x + dx, row = y + dy;
			if (column < 0 || column >= width || row < 0 || row >= height) return;
			mask[row * width + column] = 1;
		});
	}
	function dilateAlpha(pixels, width, height) {
		const mask = new Uint8Array(width * height);
		for (let index = 0; index < mask.length; index += 1) {
			if (pixels[index * RGBA.channels + RGBA.alpha] <= PACKING.minimumAlpha) continue;
			markNeighbors(mask, width, height, index % width, Math.floor(index / width));
		}
		return mask;
	}
	function encodeRow(mask, width, row, shift, stride) {
		const words = new Uint32Array(Math.ceil((width + shift) / 32));
		for (let column = 0; column < width; column += 1) {
			if (!mask[row * width + column]) continue;
			const bit = column + shift;
			words[bit >>> WORD_SHIFT] |= 1 << (bit & 31);
		}
		return Array.from(words).flatMap((word, index) => word ? [row * stride + index, word] : []);
	}
	function encodeVariants(mask, width, height, stride) {
		const rowOrder = Array.from({ length: height }, (_, row) => row).sort((a, b) => Math.abs(a - height / 2) - Math.abs(b - height / 2));
		return Array.from({ length: 32 }, (_, shift) => rowOrder.flatMap((row) => encodeRow(mask, width, row, shift, stride)));
	}
	function rasterizeShape(image, imageWidth, imageHeight, angle, stride, factory = createCanvas) {
		const radians = angle * Math.PI / 180;
		const width = Math.ceil(Math.abs(imageWidth * Math.cos(radians)) + Math.abs(imageHeight * Math.sin(radians))) + PACKING.rasterPaddingPx;
		const height = Math.ceil(Math.abs(imageWidth * Math.sin(radians)) + Math.abs(imageHeight * Math.cos(radians))) + PACKING.rasterPaddingPx;
		const { context } = createSurface(width, height, factory);
		context.translate(width / 2, height / 2);
		context.rotate(radians);
		context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
		const pixels = context.getImageData(0, 0, width, height).data;
		return {
			w: width,
			h: height,
			variants: encodeVariants(dilateAlpha(pixels, width, height), width, height, stride),
			angle,
			iw: imageWidth,
			ih: imageHeight
		};
	}

//#endregion
//#region src/screenshot-archaeology/packing-grid.js
/** Bit-grid collision checks and ordered placement search. No DOM or image work. */
	const PAIR_WIDTH = 2;
	function createGrid(region) {
		const columns = Math.floor(region.width / PACKING.cellSizeMm);
		const rows = Math.floor(region.height / PACKING.cellSizeMm);
		return Object.freeze({
			columns,
			rows,
			stride: Math.ceil(columns / 32)
		});
	}
	function hasCollision(occupied, bits, offset) {
		for (let index = 0; index < bits.length; index += PAIR_WIDTH) if (occupied[offset + bits[index]] & bits[index + 1]) return true;
		return false;
	}
	function occupy(occupied, shape, point, grid) {
		const bits = shape.variants[point.x & 31];
		const offset = point.y * grid.stride + (point.x >>> WORD_SHIFT);
		for (let index = 0; index < bits.length; index += PAIR_WIDTH) occupied[offset + bits[index]] |= bits[index + 1];
	}
	function placementScore(shape, x, y) {
		return y + shape.h + Math.abs(shape.angle) * PACKING.anglePenalty + x * PACKING.horizontalPenalty;
	}
	function findFreeColumn(occupied, shape, y, grid) {
		for (let x = 0; x <= grid.columns - shape.w; x += 1) {
			const bits = shape.variants[x & 31];
			if (hasCollision(occupied, bits, y * grid.stride + (x >>> WORD_SHIFT))) continue;
			return {
				x,
				y,
				score: placementScore(shape, x, y)
			};
		}
		return null;
	}
	function locate(occupied, shape, grid, bestScore = Infinity) {
		if (shape.w > grid.columns || shape.h > grid.rows) return null;
		for (let y = 0; y <= grid.rows - shape.h && y + shape.h <= bestScore; y += 1) {
			const candidate = findFreeColumn(occupied, shape, y, grid);
			if (candidate) return candidate;
		}
		return null;
	}

//#endregion
//#region src/screenshot-archaeology/collage-layout.js
/** Compose rasterization, collision search and scale search into a collage layout. */
	const region = PosterTemplate.contentBounds;
	const grid = createGrid(region);
	const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));
	function bounds(pose) {
		const radians = pose.rotation * Math.PI / 180;
		const width = Math.abs(pose.widthMm * Math.cos(radians)) + Math.abs(pose.heightMm * Math.sin(radians));
		const height = Math.abs(pose.widthMm * Math.sin(radians)) + Math.abs(pose.heightMm * Math.cos(radians));
		return {
			x: pose.xMm + pose.widthMm / 2 - width / 2,
			y: pose.yMm + pose.heightMm / 2 - height / 2,
			w: width,
			h: height
		};
	}
	function displayWeight(object, equal = false) {
		return equal ? 1 : (object.relativeAreaWeight || 1) ** PACKING.weightExponent;
	}
	function createSource(object, imageFor, totalWeight, equal) {
		const image = imageFor(object);
		const area = region.width * region.height * displayWeight(object, equal) / totalWeight / alphaCoverage(image);
		const ratio = image.naturalWidth / image.naturalHeight;
		return {
			id: object.id,
			image,
			w: Math.sqrt(area * ratio),
			h: Math.sqrt(area / ratio)
		};
	}
	function createSources(objects, imageFor, equal) {
		const totalWeight = objects.reduce((total, object) => total + displayWeight(object, equal), 0);
		return objects.map((object) => createSource(object, imageFor, totalWeight, equal)).sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || a.id.localeCompare(b.id));
	}
	function chooseOrientation(source, factor, occupied) {
		const width = Math.max(1, Math.round(source.w * factor / PACKING.cellSizeMm));
		const height = Math.max(1, Math.round(source.h * factor / PACKING.cellSizeMm));
		return ROTATION_ANGLES.reduce((best, angle) => {
			const shape = rasterizeShape(source.image, width, height, angle, grid.stride);
			const point = locate(occupied, shape, grid, best?.score);
			return point && (!best || point.score < best.score) ? {
				...point,
				shape
			} : best;
		}, null);
	}
	function placementFor(source, factor, { x, y, shape }) {
		const width = source.w * factor, height = source.h * factor;
		return {
			objectId: source.id,
			xMm: region.x + (x + shape.w / 2) * PACKING.cellSizeMm - width / 2,
			yMm: region.y + (y + shape.h / 2) * PACKING.cellSizeMm - height / 2,
			widthMm: width,
			heightMm: height,
			rotation: shape.angle
		};
	}
	async function packAtScale(sources, factor) {
		const occupied = new Uint32Array(grid.stride * grid.rows);
		const placements = [];
		for (const [index, source] of sources.entries()) {
			const choice = chooseOrientation(source, factor, occupied);
			if (!choice) return null;
			occupy(occupied, choice.shape, choice, grid);
			placements.push(placementFor(source, factor, choice));
			if ((index + 1) % PACKING.yieldEveryItems === 0) await yieldToBrowser();
		}
		return placements;
	}
	async function searchScale(sources, onProgress) {
		let search = {
			lower: 0,
			upper: PACKING.scaleUpperBound,
			placements: null
		};
		for (let attempt = 0; attempt < PACKING.searchAttempts; attempt += 1) {
			const factor = (search.lower + search.upper) / 2;
			const placements = await packAtScale(sources, factor);
			search = placements ? {
				...search,
				lower: factor,
				placements
			} : {
				...search,
				upper: factor
			};
			onProgress(attempt + 1);
			await yieldToBrowser();
		}
		return search.placements;
	}
	function centrePlacements(placements) {
		const boxes = placements.map(bounds);
		const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
		const right = Math.max(...boxes.map((box) => box.x + box.w)), bottom = Math.max(...boxes.map((box) => box.y + box.h));
		const offset = {
			x: region.x + (region.width - right + left) / 2 - left,
			y: region.y + (region.height - bottom + top) / 2 - top
		};
		return placements.map((pose) => ({
			...pose,
			xMm: pose.xMm + offset.x,
			yMm: pose.yMm + offset.y
		}));
	}
	async function pack(objects, imageFor, { equal = false, onProgress = () => {} } = {}) {
		if (!objects.length) return [];
		const placements = await searchScale(createSources(objects, imageFor, equal), onProgress);
		if (!placements) throw Error("This arrangement could not fit. Reset the arrangement and try again.");
		return centrePlacements(placements);
	}
	const TraceCollage = Object.freeze({
		pack,
		bounds,
		displayWeight
	});

//#endregion
//#region src/screenshot-archaeology/collage-transform.js
	const PAGE = Object.freeze({
		widthMm: 210,
		heightMm: 297
	});
	const HANDLE = Object.freeze({
		offsetPx: 18,
		edgePaddingMm: 2,
		mouseRadiusPx: 8,
		touchRadiusPx: 15
	});
	const ANGLES = Object.freeze({
		halfTurn: 180,
		fullTurn: 360,
		snapStep: 15,
		cursorSector: 45
	});
	const MINIMUM_RESIZE_FACTOR = .08;
	const DIRECTION_EPSILON = 1e-9;
	const signs = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	];
	function turn(x, y, degrees) {
		const r = degrees * Math.PI / ANGLES.halfTurn;
		return {
			x: x * Math.cos(r) - y * Math.sin(r),
			y: x * Math.sin(r) + y * Math.cos(r)
		};
	}
	function center(p) {
		return {
			x: p.xMm + p.widthMm / 2,
			y: p.yMm + p.heightMm / 2
		};
	}
	function corners(p) {
		const c = center(p);
		return signs.map(([sx, sy]) => {
			const d = turn(sx * p.widthMm / 2, sy * p.heightMm / 2, p.rotation);
			return {
				x: c.x + d.x,
				y: c.y + d.y
			};
		});
	}
	function controls(p, mmPerPixel) {
		const c = center(p), d = turn(0, -p.heightMm / 2 - HANDLE.offsetPx * mmPerPixel, p.rotation), top = turn(0, -p.heightMm / 2, p.rotation);
		return {
			corners: corners(p),
			rotation: {
				x: Math.max(HANDLE.edgePaddingMm, Math.min(PAGE.widthMm - HANDLE.edgePaddingMm, c.x + d.x)),
				y: Math.max(HANDLE.edgePaddingMm, Math.min(PAGE.heightMm - HANDLE.edgePaddingMm, c.y + d.y))
			},
			stem: {
				x: c.x + top.x,
				y: c.y + top.y
			}
		};
	}
	function hit(p, point, mmPerPixel, touch = false, withRotation = true) {
		const h = controls(p, mmPerPixel), radius = (touch ? HANDLE.touchRadiusPx : HANDLE.mouseRadiusPx) * mmPerPixel;
		if (withRotation && Math.hypot(point.x - h.rotation.x, point.y - h.rotation.y) <= radius) return { kind: "rotate" };
		const corner = h.corners.findIndex((c) => Math.hypot(point.x - c.x, point.y - c.y) <= radius);
		return corner < 0 ? null : {
			kind: "resize",
			corner
		};
	}
	function axisScaleLimit(direction, anchor, origin, length) {
		if (direction > DIRECTION_EPSILON) return (origin + length - anchor) / direction;
		if (direction < -1e-9) return (origin - anchor) / direction;
		return Infinity;
	}
	function maximumResizeFactor(pose, sx, sy, anchor, limits) {
		return signs.map(([cx, cy]) => turn((cx + sx) * pose.widthMm / 2, (cy + sy) * pose.heightMm / 2, pose.rotation)).flatMap((direction) => [axisScaleLimit(direction.x, anchor.x, limits.x, limits.width), axisScaleLimit(direction.y, anchor.y, limits.y, limits.height)]).reduce((minimum, factor) => Math.min(minimum, factor), Infinity);
	}
	function resize(p, corner, point, limits = {
		x: 0,
		y: 0,
		width: PAGE.widthMm,
		height: PAGE.heightMm
	}) {
		const [sx, sy] = signs[corner], anchor = corners(p)[(corner + 2) % 4], delta = turn(point.x - anchor.x, point.y - anchor.y, -p.rotation), vx = sx * p.widthMm, vy = sy * p.heightMm;
		const requestedFactor = (delta.x * vx + delta.y * vy) / (vx * vx + vy * vy);
		const maximum = maximumResizeFactor(p, sx, sy, anchor, limits);
		const factor = Math.max(Math.min(MINIMUM_RESIZE_FACTOR, maximum), Math.min(maximum, requestedFactor));
		const widthMm = p.widthMm * factor, heightMm = p.heightMm * factor, d = turn(sx * widthMm / 2, sy * heightMm / 2, p.rotation);
		return {
			...p,
			widthMm,
			heightMm,
			xMm: anchor.x + d.x - widthMm / 2,
			yMm: anchor.y + d.y - heightMm / 2
		};
	}
	function rotate(p, startPoint, point, snap = false) {
		const c = center(p), angle = p.rotation + (Math.atan2(point.y - c.y, point.x - c.x) - Math.atan2(startPoint.y - c.y, startPoint.x - c.x)) * 180 / Math.PI;
		return (((snap ? Math.round(angle / ANGLES.snapStep) * ANGLES.snapStep : angle) + ANGLES.halfTurn) % ANGLES.fullTurn + ANGLES.fullTurn) % ANGLES.fullTurn - ANGLES.halfTurn;
	}
	function cursor(p, corner) {
		const [sx, sy] = signs[corner], d = turn(sx, sy, p.rotation), angle = (Math.atan2(d.y, d.x) * 180 / Math.PI + 180) % 180;
		return [
			"ew-resize",
			"nwse-resize",
			"ns-resize",
			"nesw-resize"
		][Math.round(angle / ANGLES.cursorSector) % signs.length];
	}
	const TraceTransform = {
		center,
		corners,
		controls,
		hit,
		resize,
		rotate,
		cursor
	};

//#endregion
//#region src/screenshot-archaeology/collage-interaction.js
	const INTERACTION = Object.freeze({
		pageWidthMm: 210,
		pageHeightMm: 297,
		maskResolutionPx: 96,
		rgbaChannelCount: 4,
		alphaChannelIndex: 3,
		minimumHitAlpha: 8,
		primaryPointerButton: 0,
		keyboardStepMm: 1,
		keyboardFastStepMm: 5
	});
	const KEY_DIRECTIONS = Object.freeze({
		ArrowLeft: Object.freeze({
			x: -1,
			y: 0
		}),
		ArrowRight: Object.freeze({
			x: 1,
			y: 0
		}),
		ArrowUp: Object.freeze({
			x: 0,
			y: -1
		}),
		ArrowDown: Object.freeze({
			x: 0,
			y: 1
		})
	});
	const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
	/** Owns poster pointer/keyboard events, not layout or archive persistence. */
	function createCollageInteraction({ canvas, getState, getObjects, getPlacement, getImage, transforms, getContentBounds, getBaseBoxes, editObject, inspect, render, createCanvas = () => document.createElement("canvas") }) {
		const masks = /* @__PURE__ */ new Map();
		let gesture = null;
		const mmPerPixel = () => INTERACTION.pageWidthMm / canvas.getBoundingClientRect().width;
		const available = () => Boolean(getState().archive) && !getState().packing;
		const toPosterPoint = ({ clientX, clientY }) => {
			const bounds = canvas.getBoundingClientRect();
			return {
				x: (clientX - bounds.left) / bounds.width * INTERACTION.pageWidthMm,
				y: (clientY - bounds.top) / bounds.height * INTERACTION.pageHeightMm
			};
		};
		function maskFor(object) {
			if (masks.has(object.id)) return masks.get(object.id);
			const size = INTERACTION.maskResolutionPx;
			const surface = createCanvas();
			surface.width = size;
			surface.height = size;
			const context = surface.getContext("2d", { willReadFrequently: true });
			context.drawImage(getImage(object.id), 0, 0, size, size);
			const mask = context.getImageData(0, 0, size, size).data;
			masks.set(object.id, mask);
			return mask;
		}
		function containsOpaquePixel(object, point) {
			const pose = getPlacement(object), centre = transforms.center(pose);
			const radians = -pose.rotation * Math.PI / 180;
			const dx = point.x - centre.x, dy = point.y - centre.y;
			const local = {
				x: dx * Math.cos(radians) - dy * Math.sin(radians),
				y: dx * Math.sin(radians) + dy * Math.cos(radians)
			};
			if (Math.abs(local.x) > pose.widthMm / 2 || Math.abs(local.y) > pose.heightMm / 2) return false;
			const size = INTERACTION.maskResolutionPx;
			const pixel = (coordinate, length) => clamp(Math.floor((coordinate / length + .5) * size), 0, size - 1);
			const index = (pixel(local.y, pose.heightMm) * size + pixel(local.x, pose.widthMm)) * INTERACTION.rgbaChannelCount + INTERACTION.alphaChannelIndex;
			return maskFor(object)[index] > INTERACTION.minimumHitAlpha;
		}
		function findHit(point, touch = false) {
			const { selected, archive } = getState();
			const objects = getObjects().filter((object) => !getPlacement(object).hidden);
			const selectedObject = objects.find((object) => selected?.type === "object" && object.id === selected.id);
			const controlFor = (object, withRotation = true) => {
				const control = transforms.hit(getPlacement(object), point, mmPerPixel(), touch, withRotation);
				return control ? {
					object,
					...control
				} : null;
			};
			if (selectedObject) {
				const hit = controlFor(selectedObject);
				if (hit) return hit;
			}
			const frontToBack = objects.toReversed();
			if (archive.participant.collageShowBounds) {
				const handle = frontToBack.filter((object) => object !== selectedObject).map((object) => controlFor(object, false)).find(Boolean);
				if (handle) return handle;
			}
			const object = frontToBack.find((object) => containsOpaquePixel(object, point));
			return object ? {
				object,
				kind: "move"
			} : null;
		}
		function cursorFor(hit, dragging = false) {
			if (!hit) return "default";
			if (hit.kind === "resize") return transforms.cursor(getPlacement(hit.object), hit.corner);
			if (hit.kind === "rotate") return dragging ? "grabbing" : "grab";
			return "move";
		}
		function updateGesture(point, snap) {
			const { object, placement: start } = gesture;
			if (gesture.kind === "resize") {
				const resized = transforms.resize(start, gesture.corner, point, getContentBounds());
				const base = getBaseBoxes().find((box) => box.objectId === object.id);
				editObject(object, {
					scale: resized.widthMm / base.widthMm,
					xMm: resized.xMm,
					yMm: resized.yMm
				});
				return;
			}
			if (gesture.kind === "rotate") {
				editObject(object, { rotation: transforms.rotate(start, gesture.point, point, snap) });
				return;
			}
			editObject(object, {
				xMm: start.xMm + point.x - gesture.point.x,
				yMm: start.yMm + point.y - gesture.point.y
			});
		}
		function pointerDown(event) {
			if (!available() || event.button !== INTERACTION.primaryPointerButton) return;
			event.preventDefault();
			const point = toPosterPoint(event), hit = findHit(point, event.pointerType === "touch");
			inspect(hit ? {
				type: "object",
				id: hit.object.id
			} : null);
			if (hit) {
				gesture = {
					...hit,
					point,
					placement: { ...getPlacement(hit.object) }
				};
				canvas.focus({ preventScroll: true });
				canvas.setPointerCapture(event.pointerId);
			}
			render();
		}
		function pointerMove(event) {
			if (!available()) return;
			const point = toPosterPoint(event);
			if (!gesture) {
				canvas.style.cursor = cursorFor(findHit(point, event.pointerType === "touch"));
				return;
			}
			updateGesture(point, event.shiftKey);
			canvas.style.cursor = cursorFor(gesture, true);
		}
		function finishGesture() {
			if (gesture) inspect({
				type: "object",
				id: gesture.object.id
			});
			gesture = null;
			canvas.style.cursor = "default";
			render();
		}
		function keyDown(event) {
			const { archive, selected } = getState();
			const direction = KEY_DIRECTIONS[event.key];
			if (!archive || selected?.type !== "object" || !direction) return;
			event.preventDefault();
			const object = archive.objects.find((object) => object.id === selected.id), pose = getPlacement(object);
			const step = event.shiftKey ? INTERACTION.keyboardFastStepMm : INTERACTION.keyboardStepMm;
			editObject(object, {
				xMm: pose.xMm + direction.x * step,
				yMm: pose.yMm + direction.y * step
			});
			inspect(selected);
		}
		const events = {
			pointerdown: pointerDown,
			pointermove: pointerMove,
			pointerup: finishGesture,
			pointercancel: finishGesture,
			lostpointercapture: () => {
				if (gesture) finishGesture();
			},
			keydown: keyDown
		};
		Object.entries(events).forEach(([name, handler]) => canvas.addEventListener(name, handler));
		canvas.tabIndex = 0;
		return Object.freeze({
			reset() {
				gesture = null;
				masks.clear();
				canvas.style.cursor = "default";
			},
			dispose() {
				Object.entries(events).forEach(([name, handler]) => canvas.removeEventListener(name, handler));
				masks.clear();
				gesture = null;
			},
			findHit
		});
	}

//#endregion
//#region src/screenshot-archaeology/engine.js
/** Rendering strategy boundary shared by the native viewer and p5 studio. */
	const renderingHost = new RenderingHost((canvas) => canvas === field || canvas === poster);
	const workspace = new Workspace();
	let showLabels = true;
	let images = /* @__PURE__ */ new Map();
	let nodes = [];
	let graphEdges = [];
	let graphLabels = [];
	let scale = 1;
	let pan = {
		x: 0,
		y: 0
	};
	let pointer = null;
	let originalURL = null;
	let packing = false;
	const posterFontsReady = Promise.all([document.fonts.load("700 22px Basteleur"), document.fonts.load("14px Junction")]);
	const itemFrameStyle = { ...ITEM_FRAME_STYLE };
	const field = $("field");
	const poster = $("poster");
	const graph = field.getContext("2d");
	const colors = { ...RELATION_COLORS };
	const typeName = (t) => ({
		object: "Object cutout",
		image_fragment: "Image fragment",
		text_fragment: "Text fragment"
	})[t] || t.replaceAll("_", " ");
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
	async function load(data) {
		const loaded = await workspace.open(data, {
			loadAssets: loadImageAssets,
			prepareSizing: (value) => prepareCollageSizing(value.data, value.assets, {
				pack: TraceCollage.pack,
				onStatus: (text) => message("importStatus", text)
			})
		});
		if (!loaded) return;
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
		setMode(workspace.mode === "microcosm" ? "microcosm" : workspace.mode === "collage" && count ? "collage" : "constellation");
	}
	const relationLabel = (relation) => workspace.relationLabel(relation);
	const relationKey = (relation) => workspace.relationKey(relation);
	function buildRelationFilters(reset = false) {
		const groups = workspace.relationGroups(reset);
		$("relationChoices").replaceChildren();
		for (const [key, group] of groups) {
			const label = el("label", void 0, "relation-choice"), input = el("input"), name = el("span", group.label, "relation-name");
			input.type = "checkbox";
			input.value = key;
			input.checked = workspace.enabledRelationLabels.has(key);
			input.setAttribute("aria-label", group.label);
			label.style.setProperty("--relation-color", colors[group.type]);
			label.dataset.relationType = group.type;
			label.title = group.label;
			input.onchange = () => {
				if (input.checked) workspace.setRelationEnabled(key, true);
				else workspace.setRelationEnabled(key, false);
				renderGraph();
			};
			label.append(input, name);
			$("relationChoices").append(label);
		}
	}
	const visibleRelations = () => workspace.visibleRelations();
	function updateSourceList() {
		$("sourceList").replaceChildren(el("option", workspace.mode === "collage" ? "Choose a fragment" : "Choose a screenshot"));
		$("sourceList").firstChild.value = "";
		$("selectionLabel").firstChild.textContent = workspace.mode === "collage" ? "Find a fragment" : "Find a trace";
		if (!workspace.archive) return;
		const list = workspace.mode === "collage" ? collageObjects() : workspace.archive.items;
		for (const item of list) {
			const label = workspace.mode === "collage" ? workspace.archive.participant.collage[item.id]?.label || item.label : workspace.archive.observations.find((o) => o.id === item.id)?.title || item.filename;
			const o = el("option", label);
			o.value = item.id;
			$("sourceList").append(o);
		}
	}
	function setMode(next) {
		if (next === "collage" && !workspace.archive?.objects?.length) return;
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
		$("viewNote").textContent = next === "collage" ? "A draft weighted by recurring content" : next === "microcosm" ? "Themes from image + content" : "Connections proposed from content";
		$("export").textContent = next === "collage" || next === "microcosm" || isConstellationPoster() ? "Export A4 PNG" : "Export image";
		updateSourceList();
		inspect(null);
		render();
	}
	function graphSize() {
		return {
			w: field.clientWidth || 600,
			h: field.clientHeight || 600
		};
	}
	function fitGraph() {
		if (workspace.mode === "microcosm") {
			microcosmCamera = {
				zoom: 1,
				x: 0,
				y: 0
			};
			renderMicrocosm();
			return;
		}
		if (isConstellationPoster()) {
			resetConstellationCamera();
			if (workspace.archive) renderConstellationPoster();
			return;
		}
		field.style.width = "";
		field.style.height = "";
		if (!workspace.archive) return;
		const { w, h } = graphSize();
		const coords = (workspace.archive.projections[$("layout").value] || workspace.archive.projections.fused_pca)?.coordinates || {};
		let list = workspace.archive.items.map((i, n) => ({
			id: i.id,
			v: coords[i.id] || [Math.cos(n * 2.399) * Math.sqrt(n + 1), Math.sin(n * 2.399) * Math.sqrt(n + 1)]
		}));
		if (Math.max(...list.map((n) => n.v[0])) - Math.min(...list.map((n) => n.v[0])) < 1e-8) list = list.map((n, k) => ({
			...n,
			v: [Math.cos(k * 2.399) * Math.sqrt(k + 1), Math.sin(k * 2.399) * Math.sqrt(k + 1)]
		}));
		const xs = list.map((n) => n.v[0]), ys = list.map((n) => n.v[1]), minX = Math.min(...xs), minY = Math.min(...ys), dx = Math.max(...xs) - minX || 1, dy = Math.max(...ys) - minY || 1;
		const spacing = Number($("graphSpacing").value), worldW = Math.max(1e3, w) * spacing, worldH = Math.max(800, h) * spacing;
		nodes = TraceGraph.spreadNodes(list.map((n) => {
			const im = images.get(n.id);
			return {
				id: n.id,
				x: (n.v[0] - minX) / dx * worldW,
				y: (n.v[1] - minY) / dy * worldH,
				w: Math.min(90, 88 * im.width / im.height),
				h: 88
			};
		}), 48 * spacing);
		fitCamera();
	}
	function fitCamera(overview = false) {
		if (isConstellationPoster()) {
			resetConstellationCamera();
			renderGraph();
			return;
		}
		if (!nodes.length) return;
		const { w, h } = graphSize(), left = Math.min(...nodes.map((n) => n.x - n.w / 2)), right = Math.max(...nodes.map((n) => n.x + n.w / 2)), top = Math.min(...nodes.map((n) => n.y - n.h / 2)), bottom = Math.max(...nodes.map((n) => n.y + n.h / 2));
		scale = Math.min(1, Math.max(1, w - 56) / (right - left), Math.max(1, h - 56) / (bottom - top));
		if (!overview && w < 500) scale = Math.max(.5, scale);
		pan = {
			x: w / 2 - (left + right) / 2 * scale,
			y: h / 2 - (top + bottom) / 2 * scale
		};
		renderGraph();
	}
	function renderGraph() {
		if (workspace.mode === "microcosm") return renderMicrocosm();
		if (isConstellationPoster()) {
			renderConstellationPoster();
			return;
		}
		return renderingHost.paint("constellation", graph, true, paintGraph, "explore");
	}
	function paintGraph() {
		const { w, h } = graphSize(), ratio = devicePixelRatio || 1;
		if (field.width !== Math.round(w * ratio) || field.height !== Math.round(h * ratio)) {
			field.width = Math.round(w * ratio);
			field.height = Math.round(h * ratio);
		}
		graph.setTransform(ratio, 0, 0, ratio, 0, 0);
		graph.fillStyle = "#090909";
		graph.fillRect(0, 0, w, h);
		if (!workspace.archive) return;
		const screenNodes = nodes.map((n) => ({
			...n,
			x: n.x * scale + pan.x,
			y: n.y * scale + pan.y,
			w: n.w * scale,
			h: n.h * scale
		})), map = new Map(screenNodes.map((n) => [n.id, n])), relations = visibleRelations(), pairs = /* @__PURE__ */ new Map();
		for (const r of relations) {
			const key = [r.source, r.target].sort().join("|");
			if (!pairs.has(key)) pairs.set(key, []);
			pairs.get(key).push(r);
		}
		graphEdges = [];
		graphLabels = [];
		for (const group of pairs.values()) for (const [index, r] of group.entries()) {
			const [first, last] = [r.source, r.target].sort(), segment = TraceGraph.edgeSegment(map.get(first), map.get(last), (index - (group.length - 1) / 2) * 11);
			if (!segment) continue;
			const active = !workspace.selected || workspace.selected.id === r.id || workspace.selected.id === r.source || workspace.selected.id === r.target;
			graphEdges.push({
				...segment,
				relation: r,
				active
			});
			graph.globalAlpha = active ? .9 : .45;
			graph.strokeStyle = colors[r.type];
			graph.lineWidth = workspace.selected?.id === r.id ? 5 : 2.4;
			graph.setLineDash(r.type === "transformation" ? [6, 3] : r.type === "continuation" ? [2, 3] : []);
			renderingHost.element("relation", graph, {
				id: r.id,
				points: [{
					x: segment.x1,
					y: segment.y1
				}, {
					x: segment.x2,
					y: segment.y2
				}],
				color: colors[r.type],
				width: graph.lineWidth,
				opacity: graph.globalAlpha,
				dash: graph.getLineDash()
			}, () => {
				graph.beginPath();
				graph.moveTo(segment.x1, segment.y1);
				graph.lineTo(segment.x2, segment.y2);
				graph.stroke();
			});
		}
		graph.setLineDash([]);
		graph.globalAlpha = 1;
		for (const n of screenNodes) {
			renderingHost.element("screenshot", graph, {
				id: n.id,
				image: images.get(n.id),
				x: n.x - n.w / 2,
				y: n.y - n.h / 2,
				width: n.w,
				height: n.h
			}, () => graph.drawImage(images.get(n.id), n.x - n.w / 2, n.y - n.h / 2, n.w, n.h));
			if (workspace.selected?.id === n.id) {
				graph.strokeStyle = "#d4ed70";
				graph.lineWidth = 2;
				graph.strokeRect(n.x - n.w / 2 - 4, n.y - n.h / 2 - 4, n.w + 8, n.h + 8);
			}
		}
		const obstacles = screenNodes.map((n) => TraceGraph.rectPolygon({
			x: n.x - n.w / 2 - 5,
			y: n.y - n.h / 2 - 5,
			w: n.w + 10,
			h: n.h + 10
		}));
		graph.font = "12px Junction,Arial";
		const priority = (e) => workspace.selected?.id === e.relation.id ? 4 : e.active ? 2 : 0;
		for (const edge of [...graphEdges].sort((a, b) => priority(b) - priority(a) || Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))) {
			const r = edge.relation;
			if (!showLabels && workspace.selected?.id !== r.id) continue;
			const full = workspace.archive.participant.relations[r.id]?.label || r.label, maxWidth = Math.min(182, Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1) - 18);
			let text = TraceGraph.shortLabel(full), limit = 28;
			while (graph.measureText(text).width > maxWidth && limit > 5) text = TraceGraph.shortLabel(full, --limit);
			if (graph.measureText(text).width > maxWidth) continue;
			const box = TraceGraph.findLabel(edge, graph.measureText(text).width, 12, obstacles, {
				w,
				h
			});
			if (!box) continue;
			obstacles.push(box.corners);
			graphLabels.push({
				...box,
				text,
				relation: r
			});
			const labelModel = {
				id: r.id,
				x: box.x,
				y: box.y,
				angle: box.angle,
				font: "Junction",
				size: 12,
				color: colors[r.type],
				opacity: edge.active ? 1 : .65,
				background: {
					x: -box.width / 2 - 4,
					y: -20,
					width: box.width + 8,
					height: 16,
					color: "#090909",
					opacity: .92
				},
				rows: [{
					text,
					y: -5 + baselineOffset(graph, "12px Junction,Arial", text, "bottom")
				}]
			};
			renderingHost.element("label", graph, labelModel, () => {
				graph.save();
				graph.translate(box.x, box.y);
				graph.rotate(box.angle);
				graph.globalAlpha = .92;
				graph.fillStyle = "#090909";
				graph.fillRect(-box.width / 2 - 4, -20, box.width + 8, 16);
				graph.globalAlpha = edge.active ? 1 : .65;
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
		$("count").textContent = `${relations.length} / ${workspace.archive.relations.length} connections · ${graphLabels.length} labels`;
	}
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
	function posterPalette() {
		return workspace.archive?.participant.collageTheme === "dark" ? {
			background: "#000000",
			text: "#ffffff",
			outline: "#ffffff",
			cornerFill: "#000000"
		} : {
			background: "#ffffff",
			text: "#000000",
			outline: itemFrameStyle.color,
			cornerFill: "#ffffff"
		};
	}
	function posterImage(obj) {
		const light = images.get("poster:" + obj.id) || images.get(obj.id);
		if (workspace.archive.participant.collageTheme !== "dark" || !obj.posterAsset) return light;
		const key = "poster-dark:" + obj.id;
		if (images.has(key)) return images.get(key);
		const raw = images.get(obj.id), c = document.createElement("canvas");
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
			const n = Math.min(raw.naturalWidth, raw.naturalHeight) * .1, f = Math.floor(n), rounded = Math.abs(n - f - .5) < 1e-8 ? f % 2 ? f + 1 : f : Math.round(n), pad = Math.max(10, rounded), w = raw.naturalWidth + 2 * pad, h = raw.naturalHeight + 2 * pad;
			box = [
				pad / w,
				pad / h,
				raw.naturalWidth / w,
				raw.naturalHeight / h
			];
		}
		const [x, y, w, h] = box;
		ctx.drawImage(raw, x * c.width, y * c.height, w * c.width, h * c.height);
		images.set(key, c);
		return c;
	}
	function drawItemFrame(context, p, editing = false) {
		const palette = posterPalette(), c = TraceTransform.center(p), size = itemFrameStyle.cornerSizeMm;
		context.save();
		context.translate(c.x, c.y);
		context.rotate(p.rotation * Math.PI / 180);
		context.strokeStyle = palette.outline;
		context.lineWidth = itemFrameStyle.lineWidthMm;
		context.strokeRect(-p.widthMm / 2, -p.heightMm / 2, p.widthMm, p.heightMm);
		for (const [sx, sy] of [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		]) {
			const x = sx * p.widthMm / 2 - size / 2, y = sy * p.heightMm / 2 - size / 2;
			context.fillStyle = editing ? palette.outline : palette.cornerFill;
			context.fillRect(x, y, size, size);
			context.strokeStyle = palette.outline;
			context.lineWidth = .25;
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
			context.arc(h.rotation.x, h.rotation.y, Math.max(1.2, 4 * posterMmPerPixel()), 0, Math.PI * 2);
			context.fillStyle = palette.outline;
			context.fill();
			context.strokeStyle = "#111";
			context.lineWidth = .15;
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
		drawItemFrame
	});
	function renderPoster(context = poster.getContext("2d"), interactive = true) {
		return renderingHost.paint("collage", context, interactive, () => {
			const count = collagePosterRenderer.render(context, interactive);
			if (interactive && count !== void 0) $("count").textContent = `${count} / ${collageObjects().length} fragments · A4 portrait`;
		});
	}
	const inspectorController = new (createInspectorController({
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
		addMicrocosmSourceContext
	}))($("inspector"));
	function inspect(value) {
		inspectorController.show(value);
	}
	async function viewSource(id, bbox = null) {
		const source = workspace.archive.items.find((i) => i.id === id);
		$("sourceTitle").textContent = workspace.archive.observations.find((o) => o.id === id).title;
		$("sourceCaption").textContent = source.filename;
		$("sourceError").classList.add("hidden");
		$("locateLabel").classList.add("hidden");
		$("originalBox").classList.toggle("hidden", !bbox);
		if (bbox) {
			const r = $("cropRect");
			[
				"x",
				"y",
				"width",
				"height"
			].forEach((k, n) => r.setAttribute(k, bbox[n] * 1e3));
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
		if (!$("sourceDialog").open) $("sourceDialog").showModal();
		try {
			if (/^data:image\/png;base64,/.test(source.originalAsset || "")) im.src = source.originalAsset;
			else if (source.originalPath && !source.originalPath.includes("..") && !source.originalPath.startsWith("/")) im.src = source.originalPath;
			else throw Error("Original not in this JSON.");
		} catch {
			im.removeAttribute("src");
			$("sourceError").classList.remove("hidden");
			$("locateLabel").classList.remove("hidden");
		}
	}
	$("closeSource").onclick = () => $("sourceDialog").close();
	$("locateOriginal").onchange = () => {
		const file = $("locateOriginal").files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			$("originalImage").src = reader.result;
			$("sourceError").classList.add("hidden");
		};
		reader.readAsDataURL(file);
	};
	async function packAgain(equal = false) {
		if (!workspace.archive?.objects || packing) return;
		const dataset = workspace.archive, visible = collageObjects().filter((o) => !workspace.archive.participant.collage[o.id]?.hidden);
		packing = true;
		for (const id of [
			"arrange",
			"equal",
			"resetCollage"
		]) $(id).disabled = true;
		const button = $(equal ? "equal" : "arrange"), caption = button.textContent;
		button.textContent = "Filling the page…";
		try {
			const placed = await TraceCollage.pack(visible, (o) => images.get("poster:" + o.id) || images.get(o.id), { equal });
			if (workspace.archive !== dataset) return;
			workspace.applyCollageLayout(placed, visible, equal);
			inspect(workspace.selected);
			renderPoster();
		} catch (e) {
			message("importStatus", e.message, true);
		} finally {
			packing = false;
			for (const id of [
				"arrange",
				"equal",
				"resetCollage"
			]) $(id).disabled = false;
			button.textContent = caption;
		}
	}
	function hitGraph(x, y) {
		if (workspace.mode === "microcosm") return hitMicrocosm(x, y);
		if (isConstellationPoster()) return hitConstellationPoster(x, y);
		for (const n of [...nodes].reverse()) if (Math.abs(x - (n.x * scale + pan.x)) < n.w * scale / 2 + 5 && Math.abs(y - (n.y * scale + pan.y)) < n.h * scale / 2 + 5) return {
			type: "source",
			id: n.id
		};
		const point = TraceGraph.rectPolygon({
			x: x - .5,
			y: y - .5,
			w: 1,
			h: 1
		});
		for (const label of graphLabels) if (TraceGraph.polygonsOverlap(point, label.corners)) return {
			type: "relation",
			id: label.relation.id
		};
		for (const edge of [...graphEdges].reverse()) {
			const dx = edge.x2 - edge.x1, dy = edge.y2 - edge.y1, t = Math.max(0, Math.min(1, ((x - edge.x1) * dx + (y - edge.y1) * dy) / (dx * dx + dy * dy || 1)));
			if (Math.hypot(x - edge.x1 - t * dx, y - edge.y1 - t * dy) < 6) return {
				type: "relation",
				id: edge.relation.id
			};
		}
		return null;
	}
	field.onpointerdown = (e) => {
		if (!workspace.archive) return;
		const r = field.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
		pointer = {
			x,
			y,
			pan: { ...pan },
			camera: { ...constellationCamera },
			microCamera: { ...microcosmCamera },
			moved: false,
			hit: hitGraph(x, y)
		};
		field.setPointerCapture(e.pointerId);
	};
	field.onpointermove = (e) => {
		if (!pointer || !workspace.archive) return;
		const r = field.getBoundingClientRect(), dx = e.clientX - r.left - pointer.x, dy = e.clientY - r.top - pointer.y;
		if (Math.hypot(dx, dy) > 4) pointer.moved = true;
		if (pointer.moved) {
			if (workspace.mode === "microcosm") microcosmCamera = {
				...pointer.microCamera,
				x: pointer.microCamera.x + dx * 297 / r.width,
				y: pointer.microCamera.y + dy * 210 / r.height
			};
			else if (isConstellationPoster()) constellationCamera = {
				...pointer.camera,
				x: pointer.camera.x + dx * 297 / r.width,
				y: pointer.camera.y + dy * 210 / r.height
			};
			else pan = {
				x: pointer.pan.x + dx,
				y: pointer.pan.y + dy
			};
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
	field.onpointercancel = () => pointer = null;
	function zoomGraph(factor, x = graphSize().w / 2, y = graphSize().h / 2) {
		if (!workspace.archive) return;
		if (workspace.mode === "microcosm") return zoomMicrocosm(factor, x, y);
		if (isConstellationPoster()) return zoomConstellationPoster(factor, x, y);
		const next = Math.min(5, Math.max(.08, scale * factor));
		pan = {
			x: x - (x - pan.x) * next / scale,
			y: y - (y - pan.y) * next / scale
		};
		scale = next;
		renderGraph();
	}
	field.onwheel = (e) => {
		if (!workspace.archive) return;
		e.preventDefault();
		const r = field.getBoundingClientRect();
		zoomGraph(Math.exp(-e.deltaY * .001), e.clientX - r.left, e.clientY - r.top);
	};
	function hitConstellationPoster(x, y) {
		const r = field.getBoundingClientRect();
		x = (x / r.width * 297 - pan.x) / scale;
		y = (y / r.height * 210 - pan.y) / scale;
		const point = ConstellationPoster.polygon({
			x: x - .1,
			y: y - .1,
			w: .2,
			h: .2
		});
		for (const label of graphLabels) if (ConstellationPoster.overlaps(point, label.corners)) return {
			type: "relation",
			id: label.relation.id
		};
		for (const n of nodes) if (Math.abs(x - n.x) < n.w / 2 && Math.abs(y - n.y) < n.h / 2) return {
			type: "source",
			id: n.id
		};
		for (const edge of graphEdges) for (let i = 1; i < edge.points.length; i++) {
			const a = edge.points[i - 1], b = edge.points[i], dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
			if (Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < 1) return {
				type: "relation",
				id: edge.relation.id
			};
		}
		return null;
	}
	const collageInteraction = createCollageInteraction({
		canvas: poster,
		getState: () => ({
			archive: workspace.archive,
			selected: workspace.selected,
			packing
		}),
		getObjects: collageObjects,
		getPlacement: placement,
		getImage: (id) => images.get("poster:" + id) || images.get(id),
		transforms: TraceTransform,
		getContentBounds: posterContentBounds,
		getBaseBoxes: baseBoxes,
		editObject,
		inspect,
		render: renderPoster
	});
	function download(name, value, type = "application/json") {
		const blob = value instanceof Blob ? value : new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type });
		const url = URL.createObjectURL(blob), a = el("a");
		a.href = url;
		a.download = name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 3e4);
	}
	async function pngAt300Dpi(blob) {
		const bytes = new Uint8Array(await blob.arrayBuffer()), parts = [bytes.slice(0, 8)], chunk = /* @__PURE__ */ new Uint8Array(21), view = new DataView(chunk.buffer);
		view.setUint32(0, 9);
		chunk.set(new TextEncoder().encode("pHYs"), 4);
		view.setUint32(8, 11811);
		view.setUint32(12, 11811);
		chunk[16] = 1;
		let crc = 4294967295;
		for (const byte of chunk.slice(4, 17)) {
			crc ^= byte;
			for (let n = 0; n < 8; n++) crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
		}
		view.setUint32(17, (crc ^ 4294967295) >>> 0);
		for (let offset = 8; offset + 12 <= bytes.length;) {
			const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0), end = offset + length + 12;
			if (end > bytes.length) throw Error("PNG export was incomplete.");
			const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
			if (type !== "pHYs") parts.push(bytes.slice(offset, end));
			if (type === "IHDR") parts.push(chunk);
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
			message("importStatus", "Some labels do not fit. Choose fewer relations before printing this A4 poster.", true);
			return;
		}
		const win = window.open("", "_blank");
		if (!win) {
			message("importStatus", "Allow the print window, or export the A4 PNG.", true);
			return;
		}
		win.document.write("<!doctype html><html><head><title>Constellation · A4 landscape</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;background:#090909}img{display:block;width:297mm;height:210mm}</style></head><body>");
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
	function configureGraphFormat() {
		const paper = workspace.mode === "constellation" && isConstellationPoster(), filters = $("relationFilters"), stage = $("stage");
		if (paper) stage.append(filters);
		else $("graphTools").before(filters);
		filters.classList.toggle("poster-relation-filters", paper);
		stage.classList.toggle("constellation-stage", paper || workspace.mode === "microcosm");
		if (!paper) {
			filters.removeAttribute("style");
			$("relationChoices").style.gridTemplateColumns = "";
			for (const label of $("relationChoices").children) label.style.fontSize = "";
		}
		for (const id of ["layout", "graphSpacing"]) $(id).closest("label").classList.toggle("hidden", paper);
		for (const id of ["labels"]) $(id).classList.toggle("hidden", paper);
		$("resetGraph").classList.remove("hidden");
	}
	let constellationPage = null;
	let constellationCacheKey = "";
	let constellationBasePage = null;
	let constellationBaseKey = "";
	const isConstellationPoster = () => true;
	function prepareConstellationPoster() {
		const relations = workspace.archive.relations.filter((r) => workspace.archive.participant.relations[r.id]?.status !== "rejected").map((r) => ({
			...r,
			label: relationLabel(r)
		}));
		const groups = /* @__PURE__ */ new Map();
		for (const r of workspace.archive.relations) if (!groups.has(relationKey(r))) groups.set(relationKey(r), {
			key: relationKey(r),
			label: relationLabel(r),
			type: r.type
		});
		const baseKey = JSON.stringify([
			workspace.archive.datasetId,
			relations.map((r) => [
				r.id,
				r.label,
				r.type
			]),
			[...groups.keys()],
			document.fonts.check("14px Junction"),
			renderingHost.layoutOptions.thumbnailScale
		]);
		const measure = (t, size) => {
			graph.font = `${size}px Junction,Arial`;
			return graph.measureText(t).width;
		};
		if (baseKey !== constellationBaseKey) {
			const legend = ConstellationPoster.legend([...groups.values()], measure);
			constellationBasePage = {
				...ConstellationPoster.layout(workspace.archive.items, relations, workspace.archive.projections.fused_umap?.coordinates || {}, measure, legend.y + legend.h, renderingHost.layoutOptions),
				legend
			};
			constellationBaseKey = baseKey;
		}
		const key = baseKey + (constellationBasePage.unplaced.length ? JSON.stringify([...workspace.enabledRelationLabels]) : "");
		if (key === constellationCacheKey && constellationPage) return constellationPage;
		const legend = constellationBasePage.legend;
		constellationPage = constellationBasePage.unplaced.length ? {
			...ConstellationPoster.layout(workspace.archive.items, relations.filter((r) => workspace.enabledRelationLabels.has(relationKey(r))), workspace.archive.projections.fused_umap?.coordinates || {}, measure, legend.y + legend.h, renderingHost.layoutOptions),
			legend
		} : constellationBasePage;
		constellationCacheKey = key;
		return constellationPage;
	}
	let constellationCamera = {
		zoom: 1,
		x: 0,
		y: 0
	};
	function resetConstellationCamera() {
		constellationCamera = {
			zoom: 1,
			x: 0,
			y: 0
		};
	}
	function zoomConstellationPoster(factor, x, y) {
		const page = prepareConstellationPoster(), r = field.getBoundingClientRect();
		const ax = x * 297 / r.width, ay = y * 210 / r.height;
		const cx = page.bounds.x + page.bounds.w / 2, cy = page.bounds.y + page.bounds.h / 2;
		const next = Math.min(6, Math.max(.25, constellationCamera.zoom * factor));
		const ratio = next / constellationCamera.zoom;
		constellationCamera = {
			zoom: next,
			x: ax - cx - (ax - cx - constellationCamera.x) * ratio,
			y: ay - cy - (ay - cy - constellationCamera.y) * ratio
		};
		renderGraph();
	}
	function renderConstellationPoster(context = graph, interactive = true) {
		return renderingHost.paint("constellation", context, interactive, () => paintConstellationPoster(context, interactive));
	}
	function paintConstellationPoster(context, interactive) {
		prepareConstellationSurface(context, interactive);
		if (!workspace.archive) return;
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
			const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
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
		if (interactive) updateConstellationInteraction(page, drawn, visible);
	}
	function prepareConstellationSurface(context, interactive) {
		const canvas = context.canvas, ratio = devicePixelRatio || 1;
		if (interactive) {
			const stage = $("stage"), w = Math.max(220, stage.clientWidth - 44), h = Math.max(156, stage.clientHeight - 44), f = Math.min(w / 297, h / 210);
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
		context.fillText(workspace.archive.participant.constellationTitle ?? "Screenshot Archeology", 8, 16);
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
			context.fillRect(cell.x + .18, cell.y + .18, cell.w - .18 - (lastInRow ? .18 : 0), cell.h - .18 - (cell.y + cell.h >= page.legend.y + page.legend.h - .01 ? .18 : 0));
			context.fillStyle = on ? "#090909" : colors[cell.type];
			context.font = `${cell.size}px Junction,Arial`;
			context.textAlign = "center";
			context.textBaseline = "middle";
			cell.lines.forEach((line, i) => context.fillText(line, cell.x + cell.w / 2, cell.y + cell.h / 2 + (i - (cell.lines.length - 1) / 2) * cell.size * 1.15));
		}
	}
	/** Selection is an inspection effect; exported relations keep their original opacity. */
	function relationOpacity(selection, relationId, interactive) {
		const isOtherRelation = selection?.type === "relation" && selection.id !== relationId;
		return interactive && isOtherRelation ? .15 : 1;
	}
	function drawConstellationRelations(context, page, visible, interactive) {
		for (const edge of page.edges) {
			if (!visible.has(edge.relation.id)) continue;
			context.save();
			const opacity = relationOpacity(workspace.selected, edge.relation.id, interactive);
			context.globalAlpha = opacity;
			context.strokeStyle = colors[edge.relation.type];
			context.lineWidth = .55;
			renderingHost.element("relation", context, {
				id: edge.relation.id,
				points: edge.points,
				color: colors[edge.relation.type],
				width: .55,
				opacity,
				dash: []
			}, () => {
				context.beginPath();
				edge.points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
				context.stroke();
			});
			context.restore();
		}
	}
	function drawConstellationLeaders(context, page, visible, interactive) {
		for (const box of page.labels) {
			if (!visible.has(box.relation.id) || !box.leader) continue;
			context.save();
			const opacity = relationOpacity(workspace.selected, box.relation.id, interactive);
			context.globalAlpha = opacity;
			context.strokeStyle = colors[box.relation.type];
			context.lineWidth = .15;
			context.setLineDash([.5, .6]);
			renderingHost.element("relation", context, {
				id: box.relation.id,
				points: [box.leader, {
					x: box.x,
					y: box.y
				}],
				color: colors[box.relation.type],
				width: .15,
				opacity,
				dash: [.5, .6],
				leader: true
			}, () => {
				context.beginPath();
				context.moveTo(box.leader.x, box.leader.y);
				context.lineTo(box.x, box.y);
				context.stroke();
			});
			context.setLineDash([]);
			context.restore();
		}
	}
	function drawConstellationScreenshots(context, page, interactive) {
		const relation = interactive && workspace.selected?.type === "relation" ? workspace.archive.relations.find((r) => r.id === workspace.selected.id) : null;
		const highlighted = new Set(relation ? [relation.source, relation.target] : []);
		for (const n of page.nodes) {
			context.save();
			context.globalAlpha = relation && !highlighted.has(n.id) ? .2 : 1;
			renderingHost.element("screenshot", context, {
				id: n.id,
				image: images.get(n.id),
				x: n.x - n.w / 2,
				y: n.y - n.h / 2,
				width: n.w,
				height: n.h
			}, () => context.drawImage(images.get(n.id), n.x - n.w / 2, n.y - n.h / 2, n.w, n.h));
			if (interactive && (workspace.selected?.id === n.id || highlighted.has(n.id))) {
				context.strokeStyle = "#fff";
				context.globalAlpha = 1;
				context.lineWidth = .55;
				context.strokeRect(n.x - n.w / 2 - .3, n.y - n.h / 2 - .3, n.w + .6, n.h + .6);
			}
			context.restore();
		}
	}
	function drawConstellationLabels(context, page, visible, interactive) {
		const drawn = [];
		for (const box of page.labels) {
			if (!visible.has(box.relation.id)) continue;
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
					y: -box.h - .8,
					width: box.w,
					height: box.h,
					color: "#090909",
					opacity: 1
				},
				rows: box.lines.map((text, i) => ({
					text,
					y: -box.h + i * box.size * 1.18 + baselineOffset(context, `${box.size}px Junction,Arial`, text, "top")
				}))
			};
			renderingHost.element("label", context, labelModel, () => {
				context.save();
				context.translate(box.x, box.y);
				context.rotate(box.angle);
				context.fillStyle = "#090909";
				context.fillRect(-box.w / 2, -box.h - .8, box.w, box.h);
				context.globalAlpha = opacity;
				context.fillStyle = colors[box.relation.type];
				context.font = `${box.size}px Junction,Arial`;
				context.textAlign = "center";
				context.textBaseline = "top";
				box.lines.forEach((line, i) => context.fillText(line, 0, -box.h + i * box.size * 1.18));
				context.restore();
			});
			drawn.push(box);
		}
		return drawn;
	}
	function drawConstellationFooter(context) {
		context.save();
		context.globalAlpha = .5;
		context.font = "3px Junction,Arial";
		context.fillStyle = "#fff";
		context.textBaseline = "alphabetic";
		context.textAlign = "left";
		context.fillText(workspace.archive.participant.collageFooterLeft ?? workspace.archive.collage?.footerLeft ?? "", 8, 204);
		context.textAlign = "right";
		context.fillText(workspace.archive.participant.collageFooterRight ?? workspace.archive.collage?.footerRight ?? "", 289, 204);
		context.textAlign = "left";
		context.restore();
	}
	function updateConstellationInteraction(page, drawn, visible) {
		nodes = page.nodes;
		scale = constellationCamera.zoom;
		pan = {
			x: constellationCamera.x + (1 - scale) * (page.bounds.x + page.bounds.w / 2),
			y: constellationCamera.y + (1 - scale) * (page.bounds.y + page.bounds.h / 2)
		};
		graphLabels = drawn;
		graphEdges = page.edges.filter((e) => visible.has(e.relation.id));
		const r = field.getBoundingClientRect(), stage = $("stage").getBoundingClientRect(), f = r.width / 297, filters = $("relationFilters");
		Object.assign(filters.style, {
			left: `${r.left - stage.left + page.legend.x * f}px`,
			top: `${r.top - stage.top + page.legend.y * f}px`,
			width: `${page.legend.w * f}px`,
			height: `${page.legend.h * f}px`
		});
		$("relationChoices").style.gridTemplateColumns = `repeat(${page.legend.columns},minmax(0,1fr))`;
		[...$("relationChoices").children].forEach((label, i) => {
			label.style.fontSize = `${page.legend.cells[i].size * f}px`;
		});
		$("count").textContent = page.unplaced.length ? `${page.unplaced.length} labels need more space. Choose fewer relations for a legible A4 poster.` : ``;
		$("count").classList.toggle("error", page.unplaced.length > 0);
	}
	$("constellationTab").onclick = () => setMode("constellation");
	$("collageTab").onclick = () => setMode("collage");
	$("sourceList").onchange = (e) => {
		inspect(e.target.value ? {
			type: workspace.mode === "collage" ? "object" : "source",
			id: e.target.value
		} : null);
		render();
	};
	$("layout").onchange = fitGraph;
	$("graphSpacing").oninput = fitGraph;
	$("resetGraph").onclick = () => fitCamera(true);
	for (const [id, checked] of [["allRelations", true], ["noRelations", false]]) $(id).onclick = () => {
		for (const input of $("relationChoices").querySelectorAll("input")) {
			input.checked = checked;
			if (checked) workspace.setRelationEnabled(input.value, true);
			else workspace.setRelationEnabled(input.value, false);
		}
		renderGraph();
	};
	$("labels").onclick = () => {
		showLabels = !showLabels;
		$("labels").setAttribute("aria-pressed", showLabels);
		$("labels").textContent = showLabels ? "Hide labels" : "Show labels";
		renderGraph();
	};
	$("posterDarkMode").onchange = () => {
		if (workspace.archive) {
			workspace.updateParticipant({ collageTheme: $("posterDarkMode").checked ? "dark" : "light" });
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
			c.toBlob(async (blob) => download("microcosm-a4-landscape.png", await pngAt300Dpi(blob)), "image/png");
			return;
		}
		if (workspace.mode === "collage") {
			const c = document.createElement("canvas");
			renderPoster(c.getContext("2d"), false);
			c.toBlob(async (blob) => download(workspace.archive.participant.collageTheme === "dark" ? "collage-a4-dark.png" : "collage-a4.png", await pngAt300Dpi(blob)), "image/png");
		} else if (isConstellationPoster()) {
			const c = document.createElement("canvas");
			renderConstellationPoster(c.getContext("2d"), false);
			if (constellationPage.unplaced.length) {
				message("importStatus", "Some labels do not fit this A4 composition. Reduce the selected relations before exporting.", true);
				return;
			}
			c.toBlob(async (blob) => download("constellation-a4-landscape.png", await pngAt300Dpi(blob)), "image/png");
		} else field.toBlob((blob) => download("constellation.png", blob), "image/png");
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
		open: load
	});
	new ResizeObserver(() => {
		if (workspace.mode === "constellation") fitGraph();
	}).observe($("stage"));
	posterFontsReady.then(() => {
		constellationCacheKey = "";
		render();
	}).catch(() => message("importStatus", "Poster fonts could not be loaded. Reload this workspace before exporting.", true));
	/** The participant runtime can use this interface without accessing UI internals. */
	function createStudioFacade() {
		const fragments = Object.freeze({
			all: () => collageObjects(),
			placement: (id) => placement(workspace.archive.objects.find((item) => item.id === id)),
			update: (id, changes) => editObject(workspace.archive.objects.find((item) => item.id === id), changes),
			bounds: () => ({ ...posterContentBounds() })
		});
		return Object.freeze({
			get data() {
				return workspace.archive;
			},
			get view() {
				return workspace.mode;
			},
			get format() {
				return workspace.mode === "collage" || workspace.mode === "microcosm" || isConstellationPoster() ? "poster" : "explore";
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
			canvas: (view) => view === "collage" ? poster : field,
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
					itemIds: [...g.itemIds]
				})),
				nodes: (workspace.microcosmState?.nodes || []).map((n) => ({ ...n }))
			}),
			scene: () => workspace.mode === "microcosm" && workspace.microcosmState ? {
				nodes: workspace.microcosmState.nodes.map((n) => ({ ...n })),
				edges: [],
				labels: [],
				scale: microcosmCamera.zoom,
				pan: {
					x: microcosmCamera.x + (1 - microcosmCamera.zoom) * (workspace.microcosmState.bounds.x + workspace.microcosmState.bounds.w / 2),
					y: microcosmCamera.y + (1 - microcosmCamera.zoom) * (workspace.microcosmState.bounds.y + workspace.microcosmState.bounds.h / 2)
				}
			} : {
				nodes: nodes.map((item) => ({ ...item })),
				edges: graphEdges.map((item) => ({ ...item })),
				labels: graphLabels.map((item) => ({ ...item })),
				scale,
				pan: { ...pan }
			},
			renderTo: (context, view = workspace.mode, interactive = false) => {
				if (view === "collage") return renderPoster(context, interactive);
				if (view === "microcosm") return renderMicrocosm(context, interactive);
				return renderConstellationPoster(context, interactive);
			},
			configure: (settings) => {
				workspace.configurePoster(settings);
				Object.assign(colors, settings.relationColors || {});
				itemFrameStyle.color = settings.itemRectangleColor || itemFrameStyle.color;
			}
		});
	}
	let microcosmPlaying = false;
	let microcosmFrame = null;
	let microcosmLastTick = 0;
	let microcosmCamera = {
		zoom: 1,
		x: 0,
		y: 0
	};
	const microcosmPalette = MICROCOSM_PALETTE;
	function updateDatasetSummary(themeCount) {
		if (!workspace.archive) return;
		const themes = (themeCount ?? (Number(workspace.archive.participant.microcosm?.count) || 0)) || Microcosm.defaultThemeCount(workspace.archive);
		$("datasetMeta").textContent = `${workspace.archive.items.length} screenshots / ${workspace.archive.relations.length} proposed connections` + (workspace.archive.objects ? ` / ${collageObjects().length} collage fragments` : "") + ` / ${themes} proposed themes`;
	}
	function prepareMicrocosm() {
		if (!workspace.archive) return null;
		const previous = workspace.microcosmState;
		const previousKey = workspace.microcosmKey;
		workspace.prepareMicrocosm();
		const saved = workspace.archive.participant.microcosm || {};
		const { count, lens } = workspace.microcosmState;
		if (previous !== workspace.microcosmState || previousKey !== workspace.microcosmKey) {
			updateDatasetSummary(workspace.microcosmState.groups.length);
			microcosmPlaying = saved.paused === void 0 ? !matchMedia("(prefers-reduced-motion: reduce)").matches : !saved.paused;
			microcosmCamera = {
				zoom: 1,
				x: 0,
				y: 0
			};
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
			$("microcosmFocus").value = workspace.microcosmState.groups.some((g) => g.id === saved.focus) ? saved.focus : "";
			updateMicrocosmButtons();
		}
		return workspace.microcosmState;
	}
	function updateMicrocosmButtons() {
		$("microcosmPlay").textContent = microcosmPlaying ? "Pause" : "Play";
		$("microcosmPlay").setAttribute("aria-pressed", String(microcosmPlaying));
	}
	function saveMicrocosmSnapshot() {
		if (!workspace.archive || !workspace.microcosmState || workspace.microcosmState.datasetId !== workspace.archive.datasetId) return;
		workspace.updateParticipant({ microcosm: {
			count: workspace.microcosmState.count,
			lens: $("microcosmLens").value,
			projectionMode: "umap",
			paused: !microcosmPlaying,
			focus: $("microcosmFocus").value,
			snapshot: Microcosm.snapshot(workspace.microcosmState)
		} });
	}
	function stopMicrocosmFrames() {
		if (microcosmFrame !== null) cancelAnimationFrame(microcosmFrame);
		microcosmFrame = null;
		microcosmLastTick = 0;
	}
	function scheduleMicrocosm() {
		if (workspace.mode !== "microcosm" || !workspace.archive || !microcosmPlaying || document.hidden || microcosmFrame !== null) return;
		microcosmFrame = requestAnimationFrame((time) => {
			microcosmFrame = null;
			if (workspace.mode !== "microcosm" || !microcosmPlaying || document.hidden) return;
			if (!microcosmLastTick) microcosmLastTick = time;
			if (time - microcosmLastTick >= 32) {
				prepareMicrocosm();
				workspace.advanceMicrocosm((time - microcosmLastTick) / 1e3);
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
		return renderingHost.paint("microcosm", context, interactive, () => paintMicrocosm(context, interactive));
	}
	function microcosmPath(context, points) {
		if (!points.length) return;
		const last = points.at(-1), first = points[0];
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
		if (!workspace.archive) return;
		const state = prepareMicrocosm(), focus = $("microcosmFocus").value;
		context.fillStyle = "#fff";
		context.font = "700 10px Basteleur,serif";
		context.letterSpacing = "-.4px";
		context.textAlign = "left";
		context.textBaseline = "alphabetic";
		context.fillText(workspace.archive.participant.constellationTitle || "Screenshot Archeology", 8, 16);
		context.letterSpacing = "0px";
		context.font = "4px Junction,Arial";
		context.textAlign = "right";
		const cellWidth = 281 / state.groups.length;
		state.groups.forEach((group, i) => {
			const active = !focus || focus === group.id, color = microcosmPalette[group.colorIndex % microcosmPalette.length];
			context.fillStyle = active ? color : "#191919";
			context.fillRect(8 + i * cellWidth, 24, cellWidth - .25, 12);
			context.fillStyle = active ? "#090909" : color;
			context.font = "2.6px Junction,Arial";
			context.textAlign = "center";
			context.textBaseline = "middle";
			ConstellationPoster.wrap(group.label, cellWidth - 4, (t) => context.measureText(t).width).slice(0, 2).forEach((line, n) => context.fillText(line, 8 + (i + .5) * cellWidth, 28.2 + n * 2.8));
			context.font = "2.2px Junction,Arial";
			context.fillText(`${group.itemIds.length} traces`, 8 + (i + .5) * cellWidth, 33.9);
		});
		const b = state.bounds, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
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
			const members = state.nodes.filter((n) => n.groupId === group.id), color = microcosmPalette[group.colorIndex % microcosmPalette.length];
			const points = Microcosm.hull(members.flatMap((n) => [
				{
					x: n.x - n.w / 2 - 3,
					y: n.y - n.h / 2 - 3
				},
				{
					x: n.x + n.w / 2 + 3,
					y: n.y - n.h / 2 - 3
				},
				{
					x: n.x + n.w / 2 + 3,
					y: n.y + n.h / 2 + 3
				},
				{
					x: n.x - n.w / 2 - 3,
					y: n.y + n.h / 2 + 3
				}
			]));
			context.globalAlpha = focus && focus !== group.id ? .12 : 1;
			microcosmPath(context, points);
			context.fillStyle = color + "10";
			context.fill();
			context.strokeStyle = color;
			context.lineWidth = .22;
			context.setLineDash([.7, 1.3]);
			context.stroke();
			context.setLineDash([]);
			const top = Math.max(44, Math.min(...members.map((n) => n.y - n.h / 2)) - 5);
			context.fillStyle = color;
			context.font = "3px Junction,Arial";
			context.textAlign = "center";
			context.textBaseline = "bottom";
			const lines = ConstellationPoster.wrap(group.label, 55, (t) => context.measureText(t).width);
			lines.forEach((line, i) => context.fillText(line, group.x, top - (lines.length - 1 - i) * 3.3));
		}
		context.globalAlpha = 1;
		if (workspace.selected?.type === "source") {
			const from = state.nodes.find((n) => n.id === workspace.selected.id);
			if (from) for (const neighbour of Microcosm.nearest(state, from.id, 2)) {
				const to = state.nodes.find((n) => n.id === neighbour.id);
				context.strokeStyle = "#d4ed70";
				context.lineWidth = .3;
				context.setLineDash([1, 1]);
				context.beginPath();
				context.moveTo(from.x, from.y);
				context.lineTo(to.x, to.y);
				context.stroke();
				context.setLineDash([]);
			}
		}
		for (const node of state.nodes) {
			const group = state.groups.find((g) => g.id === node.groupId), color = microcosmPalette[group.colorIndex % microcosmPalette.length];
			context.save();
			context.globalAlpha = focus && focus !== node.groupId ? .2 : 1;
			context.translate(node.x, node.y);
			context.rotate(Math.sin(node.phase + state.time * .25) * .07);
			context.fillStyle = "#090909";
			context.fillRect(-node.w / 2 - .8, -node.h / 2 - .8, node.w + 1.6, node.h + 1.6);
			renderingHost.element("screenshot", context, {
				id: node.id,
				image: images.get(node.id),
				x: -node.w / 2,
				y: -node.h / 2,
				width: node.w,
				height: node.h
			}, () => context.drawImage(images.get(node.id), -node.w / 2, -node.h / 2, node.w, node.h));
			context.globalAlpha = 1;
			context.strokeStyle = workspace.selected?.id === node.id ? "#fff" : color;
			context.lineWidth = workspace.selected?.id === node.id ? .55 : .18;
			context.strokeRect(-node.w / 2 - .3, -node.h / 2 - .3, node.w + .6, node.h + .6);
			context.restore();
		}
		context.restore();
		context.globalAlpha = 1;
		drawConstellationFooter(context);
		if (interactive) {
			$("count").classList.remove("error");
			$("count").textContent = `${state.nodes.length} screenshots · ${state.groups.length} proposed themes · ${state.projection}`;
			updateMicrocosmButtons();
			scheduleMicrocosm();
		}
	}
	function microcosmPoint(x, y) {
		const r = field.getBoundingClientRect(), b = prepareMicrocosm().bounds, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
		return {
			x: cx + (x * 297 / r.width - cx - microcosmCamera.x) / microcosmCamera.zoom,
			y: cy + (y * 210 / r.height - cy - microcosmCamera.y) / microcosmCamera.zoom
		};
	}
	function hitMicrocosm(x, y) {
		const r = field.getBoundingClientRect(), state = prepareMicrocosm(), px = x * 297 / r.width, py = y * 210 / r.height;
		if (py >= 24 && py <= 36 && px >= 8 && px <= 289) return {
			type: "microcosm-theme",
			id: state.groups[Math.min(state.groups.length - 1, Math.floor((px - 8) / (281 / state.groups.length)))].id
		};
		const point = microcosmPoint(x, y);
		for (const node of state.nodes.slice().reverse()) if (Math.abs(point.x - node.x) < node.w / 2 + 1 && Math.abs(point.y - node.y) < node.h / 2 + 1) return {
			type: "source",
			id: node.id
		};
		for (const g of state.groups) if (Math.abs(point.x - g.x) < g.rx && Math.abs(point.y - g.y) < g.ry) return {
			type: "microcosm-theme",
			id: g.id
		};
		return null;
	}
	function zoomMicrocosm(factor, x, y) {
		const state = prepareMicrocosm(), r = field.getBoundingClientRect(), b = state.bounds, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
		const ax = x * 297 / r.width, ay = y * 210 / r.height, next = Math.max(.4, Math.min(5, microcosmCamera.zoom * factor)), ratio = next / microcosmCamera.zoom;
		microcosmCamera = {
			zoom: next,
			x: ax - cx - (ax - cx - microcosmCamera.x) * ratio,
			y: ay - cy - (ay - cy - microcosmCamera.y) * ratio
		};
		renderMicrocosm();
	}
	$("microcosmTab").onclick = () => setMode("microcosm");
	$("microcosmPlay").onclick = () => {
		if (!workspace.archive) return;
		prepareMicrocosm();
		microcosmPlaying = !microcosmPlaying;
		if (microcosmPlaying) scheduleMicrocosm();
		else stopMicrocosmFrames();
		updateMicrocosmButtons();
		saveMicrocosmSnapshot();
		renderMicrocosm();
	};
	$("microcosmCount").onchange = () => {
		if (!workspace.archive) return;
		const count = Number($("microcosmCount").value);
		workspace.updateParticipant({ microcosm: {
			count,
			lens: $("microcosmLens").value,
			projectionMode: "umap",
			paused: !microcosmPlaying
		} });
		workspace.invalidateMicrocosm();
		prepareMicrocosm();
		saveMicrocosmSnapshot();
		inspect(null);
		renderMicrocosm();
	};
	for (const control of ["microcosmLens"]) $(control).onchange = () => {
		if (!workspace.archive) return;
		workspace.updateParticipant({ microcosm: {
			count: Number($("microcosmCount").value),
			lens: $("microcosmLens").value,
			projectionMode: "umap",
			paused: !microcosmPlaying
		} });
		workspace.invalidateMicrocosm();
		prepareMicrocosm();
		saveMicrocosmSnapshot();
		inspect(null);
		renderMicrocosm();
	};
	$("microcosmFocus").onchange = () => {
		const id = $("microcosmFocus").value;
		inspect(id ? {
			type: "microcosm-theme",
			id
		} : null);
		saveMicrocosmSnapshot();
		renderMicrocosm();
	};
	$("microcosmFit").onclick = () => {
		microcosmCamera = {
			zoom: 1,
			x: 0,
			y: 0
		};
		renderMicrocosm();
	};
	$("printCurrent").onclick = () => {
		if (!workspace.archive) return;
		if (workspace.mode === "microcosm") return printMicrocosmPoster();
		if (workspace.mode === "collage") return printCollagePoster();
		return printConstellationPoster();
	};
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) stopMicrocosmFrames();
		else scheduleMicrocosm();
	});
	function showMicrocosmOverview(panel) {
		const state = prepareMicrocosm();
		panel.append(el("p", "Switch between specific content, visual characteristics and their combination. These are proposed readings; select a trace to inspect the visible evidence.", "muted"));
		panel.append(el("p", state.method + " · " + state.projection, "small"));
		if (!state.detailed) panel.append(el("p", "This archive uses older, broad features. Reanalyse in the analyzer to enable detailed content and visual lenses.", "small"));
		panel.append(el("p", "Small proposed groups support comparison; their size is limited for exploration. Labels are clues from members, not traits guaranteed for every image.", "small"));
		for (const group of state.groups) action(panel, `${group.label} · ${group.itemIds.length}`, () => {
			inspect({
				type: "microcosm-theme",
				id: group.id
			});
			renderMicrocosm();
		}, true).classList.add("source-button");
	}
	function showMicrocosmTheme(panel, id) {
		const state = prepareMicrocosm(), group = state.groups.find((g) => g.id === id);
		if (!group) return showMicrocosmOverview(panel);
		$("microcosmFocus").value = id;
		panel.append(el("p", "Proposed theme", "type-label"), el("h2", group.label), ...group.summary ? [el("p", group.summary)] : [], el("p", `${group.itemIds.length} screenshots · ${group.keywords.join(" · ")}`, "rule"));
		panel.append(el("p", state.method + (group.summarySource === "cluster-summary" ? ". Theme names summarise the members through the selected lens." : ". This older archive shows representative descriptors; reanalyse to obtain theme summaries."), "small"));
		for (const sourceId of group.itemIds) action(panel, workspace.archive.observations.find((o) => o.id === sourceId)?.title || sourceId, () => {
			inspect({
				type: "source",
				id: sourceId
			});
			renderMicrocosm();
		}, true).classList.add("source-button");
		action(panel, "Show all themes", () => {
			$("microcosmFocus").value = "";
			inspect(null);
			saveMicrocosmSnapshot();
			renderMicrocosm();
		});
	}
	function addMicrocosmSourceContext(panel, id) {
		const state = prepareMicrocosm(), group = state.groups.find((g) => g.itemIds.includes(id));
		if (group) action(panel, "Theme · " + group.label, () => {
			inspect({
				type: "microcosm-theme",
				id: group.id
			});
			renderMicrocosm();
		}, true).classList.add("source-button");
		const detail = workspace.archive.microcosm?.items?.find((o) => o.id === id);
		if (detail) for (const [key, title] of [
			["content", "Specific content"],
			["visual", "Visual evidence"],
			["design_references", "Possible design associations"]
		]) {
			if (!detail[key]?.length) continue;
			panel.append(el("h3", title));
			for (const entry of detail[key]) {
				panel.append(el("p", entry.label));
				panel.append(el("p", entry.evidence + (entry.uncertainty ? " · " + entry.uncertainty : ""), "small"));
			}
		}
		const nearby = Microcosm.nearest(state, id, 2);
		if (nearby.length) {
			panel.append(el("h3", "Nearby · " + state.lens));
			for (const n of nearby) action(panel, workspace.archive.observations.find((o) => o.id === n.id)?.title || n.id, () => {
				inspect({
					type: "source",
					id: n.id
				});
				renderMicrocosm();
			}, true).classList.add("source-button");
		}
	}
	async function printMicrocosmPoster() {
		if (!workspace.archive) return;
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
		win.document.write("<!doctype html><html><head><title>Microcosm · A4 landscape</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;background:#090909}img{display:block;width:297mm;height:210mm}</style></head><body>");
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
		if (workspace.mode === "collage") renderPoster();
		else if (workspace.mode === "microcosm") renderMicrocosm();
		else renderGraph();
	}
	window.addEventListener("DOMContentLoaded", () => {
		message("importStatus", "");
	});
	const ScreenshotWorkshop = createStudioFacade();
	window.ScreenshotWorkshop = ScreenshotWorkshop;

//#endregion
//#region src/screenshot-archaeology/p5-runtime.js
/** Expose original pixels as globalThis.p5.Element images without a second rasterization pass. */
	var P5AssetLibrary = class {
		#images = /* @__PURE__ */ new WeakMap();
		image(source) {
			if (this.#images.has(source)) return this.#images.get(source);
			const width = source.naturalWidth || source.width;
			const height = source.naturalHeight || source.height;
			const image = new globalThis.p5.Element(source);
			image.width = width;
			image.height = height;
			image.canvas = source;
			this.#images.set(source, image);
			return image;
		}
	};
	/** Own p5 drawing targets, units and temporary export surfaces. */
	var P5SurfaceManager = class {
		#facade;
		#studio;
		#collage;
		#tools = /* @__PURE__ */ new WeakMap();
		constructor(facade, studio) {
			this.#facade = facade;
			this.#studio = studio;
		}
		createCanvases() {
			const field = this.#studio.canvas("constellation");
			const poster = this.#studio.canvas("collage");
			const saved = [field, poster].map((canvas) => ({
				canvas,
				parent: canvas.parentNode,
				id: canvas.id,
				style: canvas.getAttribute("style"),
				className: canvas.className
			}));
			this.#facade.pixelDensity(1);
			this.#facade.createCanvas(600, 400, field);
			this.#collage = this.#facade.createGraphics(A4.portrait.widthPx, A4.portrait.heightPx, poster);
			this.#collage.pixelDensity(1);
			for (const savedCanvas of saved) this.#restoreElement(savedCanvas);
		}
		#restoreElement({ canvas, parent, id, style, className }) {
			canvas.id = id;
			canvas.className = className;
			if (style === null) canvas.removeAttribute("style");
			else canvas.setAttribute("style", style);
			if (canvas.parentNode !== parent) parent.append(canvas);
		}
		acquire(context) {
			if (context.canvas === this.#studio.canvas("constellation")) return {
				target: this.#facade,
				release() {}
			};
			if (context.canvas === this.#studio.canvas("collage")) return {
				target: this.#drawingTools(this.#collage),
				release() {}
			};
			const graphics = this.#facade.createGraphics(context.canvas.width, context.canvas.height, context.canvas);
			graphics.pixelDensity(1);
			return {
				target: this.#drawingTools(graphics),
				release: () => graphics.remove()
			};
		}
		#drawingTools(graphics) {
			if (!this.#tools.has(graphics)) {
				const tools = new Proxy(graphics, { get: (target, name) => {
					const value = Reflect.get(target, name, target);
					if (value === void 0) return this.#facade[name];
					return typeof value === "function" ? value.bind(target) : value;
				} });
				this.#tools.set(graphics, tools);
			}
			return this.#tools.get(graphics);
		}
		frame(view, context, interactive, format = "poster") {
			const isPoster = format === "poster";
			return {
				data: this.#studio.data,
				view,
				format: isPoster ? "poster" : "explore",
				units: isPoster ? "mm" : "px",
				interactive,
				width: isPoster ? view === "collage" ? 210 : 297 : context.canvas.clientWidth,
				height: isPoster ? view === "collage" ? 297 : 210 : context.canvas.clientHeight
			};
		}
		withCoordinates(target, context, frame, draw) {
			const matrix = context.getTransform();
			target.push();
			try {
				target.resetMatrix();
				context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
				draw();
			} finally {
				target.pop();
			}
		}
	};
	/** Dispatch actual scene elements to the participant's p5 drawing functions. */
	var P5ScenePainter = class {
		#settings;
		#drawers;
		#assets;
		#surfaces;
		#activeSurface = null;
		constructor(settings, drawers, assets, surfaces) {
			this.#settings = settings;
			this.#drawers = drawers;
			this.#assets = assets;
			this.#surfaces = surfaces;
		}
		paint(view, context, interactive, drawScene, format) {
			const surface = this.#surfaces.acquire(context);
			const previous = this.#activeSurface;
			const frame = this.#surfaces.frame(view, context, interactive, format);
			this.#activeSurface = {
				...surface,
				context,
				frame
			};
			try {
				context.lineCap = "butt";
				context.lineJoin = "miter";
				drawScene();
				this.#drawExtraLayer(view, context, surface.target, frame);
			} finally {
				this.#activeSurface = previous;
				surface.release();
			}
		}
		element(kind, context, model) {
			const drawer = this.#drawers[kind];
			if (!drawer || !this.#activeSurface) return false;
			const { target, frame } = this.#activeSurface;
			const element = model.image ? {
				...model,
				image: this.#assets.image(model.image)
			} : model;
			this.#surfaces.withCoordinates(target, context, frame, () => {
				drawer(target, element, frame);
			});
			return true;
		}
		#drawExtraLayer(view, context, target, frame) {
			const callback = view === "collage" ? this.#settings.drawCollage : view === "microcosm" ? this.#settings.drawMicrocosm : this.#settings.drawConstellation;
			if (!callback) return;
			this.#surfaces.withCoordinates(target, context, frame, () => callback(target, frame));
		}
	};
	/** Public p5 lifecycle; scheduling and renderer implementation remain private. */
	var ScreenshotStudio = class {
		#studio;
		#settings;
		#drawers;
		#facade = null;
		#surfaces = null;
		#painter = null;
		#ready = false;
		#drawing = false;
		#scheduled = null;
		#pending = false;
		#frames = 0;
		constructor(studio, settings, drawers) {
			this.#studio = studio;
			this.#settings = settings;
			this.#drawers = drawers;
			studio.configure(settings);
			studio.registerRenderer({
				isDrawing: () => this.#drawing,
				request: () => this.request(),
				flush: () => this.flush(),
				paint: (...args) => this.#paint(...args),
				element: (...args) => this.#painter?.element(...args) || false,
				layoutOptions: () => ({ thumbnailScale: settings.screenshotScale || 1 })
			});
		}
		get ready() {
			return this.#ready;
		}
		get frames() {
			return this.#frames;
		}
		get settings() {
			return this.#settings;
		}
		setup(facade) {
			this.#facade = facade;
			this.#surfaces = new P5SurfaceManager(facade, this.#studio);
			this.#surfaces.createCanvases();
			this.#painter = new P5ScenePainter(this.#settings, this.#drawers, new P5AssetLibrary(), this.#surfaces);
			facade.noLoop();
			this.#ready = true;
			this.#studio.enableImport?.();
			this.request();
		}
		draw() {
			if (!this.#ready || this.#drawing) return;
			this.#drawing = true;
			this.#frames++;
			try {
				this.#studio.refresh();
			} finally {
				this.#drawing = false;
			}
		}
		request() {
			this.#pending = true;
			if (!this.#ready || this.#drawing || this.#scheduled !== null) return;
			this.#scheduled = requestAnimationFrame(async () => {
				this.#scheduled = null;
				this.#pending = false;
				try {
					await this.#facade.redraw();
				} catch (error) {
					console.error(error);
					this.#studio.reportError(`Check your sketch: ${error.message}`);
				}
				if (this.#pending) this.request();
			});
		}
		async flush() {
			if (!this.#ready) return;
			if (this.#scheduled !== null) cancelAnimationFrame(this.#scheduled);
			this.#scheduled = null;
			this.#pending = false;
			await this.#facade.redraw();
		}
		#paint(view, context, interactive, drawScene, format) {
			if (!this.#ready) return drawScene();
			return this.#painter.paint(view, context, interactive, drawScene, format);
		}
	};

//#endregion
//#region src/sketch.js
	const workshop = new ScreenshotStudio(ScreenshotWorkshop, SETTINGS, createPosterDrawers(SETTINGS));
	new globalThis.p5((p) => {
		p.setup = () => workshop.setup(p);
		p.draw = () => workshop.draw();
		p.windowResized = () => workshop.request();
	});

//#endregion
})();