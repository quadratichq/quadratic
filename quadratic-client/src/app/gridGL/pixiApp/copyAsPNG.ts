import { Matrix, Renderer } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from './PixiApp';

const resolution = 4;
const borderSize = 1;
const maxTextureSize = 4096;

let renderer: Renderer | undefined;

function prepareRenderer(): Renderer {
  if (!renderer) {
    renderer = new Renderer({
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });
  }
  return renderer;
}

export const getScreenImage = async (): Promise<Blob | null> => {
  const renderer = prepareRenderer();
  renderer.render(pixiApp.viewportContents);
  return new Promise((resolve) => {
    renderer!.view.toBlob?.((blob) => resolve(blob));
  });
};

/** returns a dataURL to a copy of the selected cells */
export const copyAsPNG = async (): Promise<Blob | null> => {
  const renderer = prepareRenderer();

  const rect = sheets.sheet.cursor.getLargestRectangle();
  if (!rect) return null;

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
  pixiApp.prepareForCopying();

  const transform = new Matrix();
  transform.translate(-screenRect.x + borderSize / 2, -screenRect.y + borderSize / 2);
  const scale = imageWidth / (screenRect.width * resolution);
  transform.scale(scale, scale);
  renderer.render(pixiApp.viewportContents, { transform });
  pixiApp.cleanUpAfterCopying();
  return new Promise((resolve) => {
    renderer!.view.toBlob?.((blob) => resolve(blob));
  });
};
