import { Matrix, Renderer } from 'pixi.js';
import { PixiApp } from './PixiApp';

const resolution = 4;
const borderSize = 1;
const maxTextureSize = 4096;

let renderer: Renderer | undefined;

/** returns a dataURL to a copy of the selected cells */
export const copyAsPNG = async (app: PixiApp): Promise<Blob | null> => {
  if (!renderer) {
    renderer = new Renderer({
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });
  }

  let column, width, row, height;
  const cursor = app.sheet.cursor;
  if (cursor.multiCursor) {
    const { originPosition, terminalPosition } = cursor.multiCursor;
    column = originPosition.x;
    row = originPosition.y;
    width = terminalPosition.x - column + 1;
    height = terminalPosition.y - row + 1;
  } else {
    column = cursor.cursorPosition.x;
    row = cursor.cursorPosition.y;
    width = height = 1;
  }
  const rectangle = app.sheet.gridOffsets.getScreenRectangle(column, row, width, height);

  // captures bottom-right border size
  rectangle.width += borderSize * 2;
  rectangle.height += borderSize * 2;

  let imageWidth = rectangle.width * resolution,
    imageHeight = rectangle.height * resolution;
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
  app.prepareForCopying();
  app.settings.temporarilyHideCellTypeOutlines = true;

  // todo
  // app.cells.drawCells(app.sheet, rectangle, false);
  const transform = new Matrix();
  transform.translate(-rectangle.x + borderSize / 2, -rectangle.y + borderSize / 2);
  const scale = imageWidth / (rectangle.width * resolution);
  transform.scale(scale, scale);
  renderer.render(app.viewportContents, { transform });
  app.cleanUpAfterCopying();
  app.settings.temporarilyHideCellTypeOutlines = false;
  return new Promise((resolve) => {
    renderer!.view.toBlob((blob) => resolve(blob));
  });
};
