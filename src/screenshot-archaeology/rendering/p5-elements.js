/** Drawing only: models arrive prepared in poster millimetres. */
export function createPosterDrawers(SETTINGS) {
  function drawScreenshot(p, screenshot) {
    p.imageMode(p.CORNER);
    p.noTint();

    p.image(
      screenshot.image,
      screenshot.x,
      screenshot.y,
      screenshot.width,
      screenshot.height,
    );
  }

  function drawRelation(p, relation) {
    p.stroke(relation.color);
    p.strokeWeight(relation.width * SETTINGS.relationLineScale);
    p.strokeCap(p.SQUARE);

    // Use the underlying canvas context for the dash pattern and exact opacity.
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

    // rows contains the full label text, with positions calculated to avoid overlaps.
    for (const row of label.rows) {
      p.text(row.text, 0, row.y);
    }
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
    fragment: drawFragment,
  };
}
