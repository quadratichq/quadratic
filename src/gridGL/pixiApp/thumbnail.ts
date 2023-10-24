import { Matrix, Renderer } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from './PixiApp';
import { pixiAppSettings } from './PixiAppSettings';

const width = 30;
const height = 30;
const resolution = 1;
const borderSize = 0;
const maxTextureSize = 4096;

let renderer: Renderer | undefined;

/** returns a dataURL to a copy of the selected cells */
export const thumbnail = async (): Promise<Blob | null> => {
  if (!renderer) {
    renderer = new Renderer({
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });
  }

  const sheet = sheets.getFirst();

  // might make sense to use bounds instead of (0, 0, width, height)
  const rectangle = sheet.getScreenRectangle(0, 0, width, height);

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
  pixiApp.prepareForCopying({ gridLines: true });
  pixiAppSettings.temporarilyHideCellTypeOutlines = true;

  const transform = new Matrix();
  transform.translate(-rectangle.x + borderSize / 2, -rectangle.y + borderSize / 2);
  const scale = imageWidth / (rectangle.width * resolution);
  transform.scale(scale, scale);
  renderer.render(pixiApp.viewportContents, { transform });
  pixiApp.cleanUpAfterCopying();
  pixiAppSettings.temporarilyHideCellTypeOutlines = false;
  return new Promise((resolve) => {
    renderer!.view.toBlob((blob) => {
      console.log(`blob size: ${Math.round(blob!.size / 1000)}kb`);
      resolve(blob);
    });
  });
};
