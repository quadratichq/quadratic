import { Matrix, Renderer } from 'pixi.js';
import { apiClient } from '../../api/apiClient';
import { debugShowFileIO } from '../../debugFlags';
import { grid } from '../../grid/controller/Grid';
import { sheets } from '../../grid/controller/Sheets';
import { debugTimeCheck, debugTimeReset } from '../helpers/debugPerformance';
import { pixiApp } from './PixiApp';
import { pixiAppSettings } from './PixiAppSettings';

export const thumbnailColumns = 30;
export const thumbnailRows = 30;
const resolution = 1;
const borderSize = 0;
const maxTextureSize = 2048;

// time when renderer is not busy to perform an action
const TIME_FOR_IDLE = 1000;

class Thumbnail {
  private lastUpdate = 0;
  private renderer?: Renderer;

  rendererBusy() {
    this.lastUpdate = performance.now();
  }

  async check() {
    if (grid.thumbnailDirty) {
      const now = performance.now();
      if (this.lastUpdate + TIME_FOR_IDLE > now) {
        const url = window.location.pathname.split('/');
        const uuid = url[2];
        if (uuid) {
          debugTimeReset();
          this.generate().then((blob) => {
            if (blob) {
              debugTimeCheck('thumbnail');
              apiClient.updateFilePreview(uuid, blob).then(() => {
                if (debugShowFileIO) {
                  console.log(`[Thumbnail] uploaded file (${Math.round(blob!.size / 1000)}kb).`);
                }
              });
            }
          });
          grid.thumbnailDirty = false;
        }
        this.lastUpdate = performance.now();
      }
    }
  }

  /** returns a dataURL to a copy of the selected cells */
  private async generate(): Promise<Blob | null> {
    if (!this.renderer) {
      this.renderer = new Renderer({
        resolution,
        antialias: true,
        backgroundColor: 0xffffff,
      });
    }

    const sheet = sheets.getFirst();

    // might make sense to use bounds instead of (0, 0, width, height)
    const rectangle = sheet.getScreenRectangle(0, 0, thumbnailColumns, thumbnailRows);

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
    this.renderer.resize(imageWidth, imageHeight);
    this.renderer.view.width = imageWidth;
    this.renderer.view.height = imageHeight;
    pixiApp.prepareForCopying({ gridLines: true });
    pixiAppSettings.temporarilyHideCellTypeOutlines = true;

    const transform = new Matrix();
    transform.translate(-rectangle.x + borderSize / 2, -rectangle.y + borderSize / 2);
    const scale = imageWidth / (rectangle.width * resolution);
    transform.scale(scale, scale);
    this.renderer.render(pixiApp.viewportContents, { transform });
    pixiApp.cleanUpAfterCopying();
    pixiAppSettings.temporarilyHideCellTypeOutlines = false;
    return new Promise((resolve) => {
      this.renderer!.view.toBlob((blob) => resolve(blob));
    });
  }
}

export const thumbnail = new Thumbnail();
