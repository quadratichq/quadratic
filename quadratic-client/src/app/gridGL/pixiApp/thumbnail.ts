import { events } from '@/app/events/events';
import { apiClient } from '@/shared/api/apiClient';
import type { Renderer } from 'pixi.js';
import { autoDetectRenderer, Rectangle } from 'pixi.js';
import { debugShowFileIO } from '../../debugFlags';
import { debugTimeCheck, debugTimeReset } from '../helpers/debugPerformance';
import { pixiApp } from './PixiApp';

// This also needs to be changed in thumbnail.rs
const imageWidth = 1280;
const imageHeight = imageWidth / (16 / 9);

// time when renderer is not busy to perform an action
const TIME_FOR_IDLE = 1000;

class Thumbnail {
  private lastUpdate = 0;
  private thumbnailDirty = false;
  private renderer?: Renderer;

  constructor() {
    events.on('generateThumbnail', this.setThumbnailDirty);
  }

  setThumbnailDirty = () => {
    this.thumbnailDirty = true;
  };

  destroy() {
    events.off('generateThumbnail', this.setThumbnailDirty);
    this.renderer?.destroy(false);
  }

  rendererBusy() {
    this.lastUpdate = performance.now();
  }

  async check() {
    if (this.thumbnailDirty) {
      const now = performance.now();
      if (this.lastUpdate + TIME_FOR_IDLE > now) {
        const url = window.location.pathname.split('/');
        const uuid = url[2];
        if (uuid) {
          debugTimeReset();
          this.generate().then((blob) => {
            if (blob) {
              // Open blob in new tab for preview
              // const url = URL.createObjectURL(blob);
              // window.open(url);
              // URL.revokeObjectURL(url);

              debugTimeCheck('thumbnail', 20);
              apiClient.files.thumbnail.update(uuid, blob).then(() => {
                if (debugShowFileIO) {
                  console.log(`[Thumbnail] uploaded file (${Math.round(blob!.size / 1000)}kb).`);
                }
              });
            }
          });
          this.thumbnailDirty = false;
        }
        this.lastUpdate = performance.now();
      }
    }
  }

  /** returns a dataURL to a copy of the selected cells */
  private async generate(): Promise<Blob | null> {
    if (!this.renderer) {
      this.renderer = await autoDetectRenderer({
        antialias: true,
        backgroundColor: 0xffffff,
      });
    }

    this.renderer.resize(imageWidth, imageHeight);
    this.renderer.canvas.width = imageWidth;
    this.renderer.canvas.height = imageHeight;
    const rectangle = new Rectangle(0, 0, imageWidth, imageHeight);
    pixiApp.prepareForCopying({ gridLines: true, cull: rectangle });
    pixiApp.gridLines.update(rectangle, undefined, true);
    this.renderer.render({ container: pixiApp.viewportContents });
    pixiApp.cleanUpAfterCopying(true);
    pixiApp.gridLines.update(undefined, undefined, true);
    return new Promise((resolve) => {
      this.renderer!.canvas.toBlob?.((blob) => resolve(blob));
    });
  }
}

export const thumbnail = new Thumbnail();
