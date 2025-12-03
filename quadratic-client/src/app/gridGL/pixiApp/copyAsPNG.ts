import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { Matrix, Renderer } from 'pixi.js';

const resolution = 4;
const borderSize = 1;
const maxTextureSize = 4096;

let renderer: Renderer | undefined;

export const getScreenImage = async (): Promise<Blob | null> => {
  return new Promise((resolve) => {
    pixiApp.renderer.view.toBlob?.((blob) => resolve(blob));
  });
};

/** returns a dataURL to a copy of the selected cells */
export const copyAsPNG = async (): Promise<Blob | null> => {
  if (!renderer) {
    renderer = new Renderer({
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });
  }

  const rect = sheets.sheet.cursor.getLargestRectangle();
  if (!rect) return null;

  const sheetId = sheets.current;
  const screenRect = sheets.sheet.getScreenRectangle(rect.x, rect.y, rect.width, rect.height);

  // captures bottom-right border size
  screenRect.width += borderSize * 2 - 1;
  screenRect.height += borderSize * 2 - 1;

  let imageWidth = screenRect.width * resolution,
    imageHeight = screenRect.height * resolution;
  if (Math.max(imageWidth, imageHeight) > maxTextureSize) {
    if (imageWidth > imageHeight) {
      imageHeight = imageHeight * (maxTextureSize / imageWidth);
      imageWidth = maxTextureSize;
    } else {
      imageWidth = imageWidth * (maxTextureSize / imageHeight);
      imageHeight = maxTextureSize;
    }
  }
  renderer.resize(imageWidth, imageHeight);
  renderer.view.width = imageWidth;
  renderer.view.height = imageHeight;
  await content.prepareForCopying({ sheetId, cull: screenRect, gridLines: true });

  // Update gridlines for the specific rectangle before rendering
  const gridLinesScale = pixiApp.viewport.scale.x * resolution;
  content.gridLines.update(screenRect, gridLinesScale, true);

  const transform = new Matrix();
  transform.translate(-screenRect.x + borderSize / 2, -screenRect.y + borderSize / 2);
  const scale = imageWidth / (screenRect.width * resolution);
  transform.scale(scale, scale);
  renderer.render(content, { transform });
  const viewportBounds = pixiApp.viewport.getVisibleBounds();
  content.cleanUpAfterCopying(viewportBounds);
  // Restore gridlines for the viewport
  content.gridLines.update(undefined, undefined, true);

  // force a pixiApp rerender to clean up interactions (I think)
  pixiApp.setViewportDirty();

  focusGrid();
  return new Promise((resolve) => {
    renderer!.view.toBlob?.((blob) => resolve(blob));
  });
};
