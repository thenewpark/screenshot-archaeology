import { A4 } from "../visual-config.js";
export function createCollagePosterRenderer({
  workspace,
  collageObjects,
  posterPalette,
  PosterTemplate,
  posterContentBounds,
  placement,
  posterImage,
  renderingHost,
  drawItemFrame,
}) {
  class CollagePosterRenderer {
    render(context, interactive) {
      if (!workspace.archive?.objects) {
        return;
      }

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
      const title =
        workspace.archive.participant.collageTitle ??
        workspace.archive.collage.title ??
        PosterTemplate.title;
      const tracking =
        workspace.archive.collage.template?.titleLetterSpacingEm ?? -0.04;
      let size = 22;
      let metrics;

      context.textAlign = "left";
      context.textBaseline = "alphabetic";

      do {
        context.font = `700 ${size}px Basteleur,serif`;
        context.letterSpacing = `${size * tracking}px`;
        metrics = context.measureText(title);

        if (
          Math.max(
            metrics.width,
            metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
          ) <= 196 &&
          metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent <= 23
        ) {
          break;
        }
        size -= 0.1;
      } while (size > 1);

      context.fillStyle = posterPalette().text;
      context.fillText(
        title,
        7 + metrics.actualBoundingBoxLeft,
        7 + metrics.actualBoundingBoxAscent,
      );
      context.letterSpacing = "0px";
    }

    #drawFooter(context) {
      context.save();
      context.globalAlpha = 0.5;
      const left =
        workspace.archive.participant.collageFooterLeft ??
        workspace.archive.collage.footerLeft ??
        PosterTemplate.footerLeft;
      const right =
        workspace.archive.participant.collageFooterRight ??
        workspace.archive.collage.footerRight ??
        PosterTemplate.footerRight;
      let size = 3.8;

      do {
        context.font = `${size}px Junction,sans-serif`;
        if (context.measureText(left).width + context.measureText(right).width <= 184) {
          break;
        }
        size -= 0.05;
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

        if (pose.hidden) {
          continue;
        }

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
          rotation: pose.rotation,
        };

        renderingHost.element("fragment", context, fragment, () => {
          context.save();
          context.translate(pose.xMm + pose.widthMm / 2, pose.yMm + pose.heightMm / 2);
          context.rotate((pose.rotation * Math.PI) / 180);
          context.drawImage(
            image,
            -pose.widthMm / 2,
            -pose.heightMm / 2,
            pose.widthMm,
            pose.heightMm,
          );
          context.restore();
        });
      }

      context.restore();
      return count;
    }

    #drawControls(context, interactive) {
      if (workspace.archive.participant.collageShowBounds) {
        for (const object of collageObjects()) {
          const pose = placement(object);

          if (!pose.hidden && (!interactive || workspace.selected?.id !== object.id)) {
            drawItemFrame(context, pose);
          }
        }
      }

      if (interactive && workspace.selected?.type === "object") {
        const object = workspace.archive.objects.find(
          (item) => item.id === workspace.selected.id,
        );
        const pose = placement(object);

        if (!pose.hidden) {
          drawItemFrame(context, pose, true);
        }
      }
    }
  }
  return new CollagePosterRenderer();
}
