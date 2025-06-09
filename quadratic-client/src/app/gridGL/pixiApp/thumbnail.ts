import { events } from '@/app/events/events';
import { apiClient } from '@/shared/api/apiClient';
import { Rectangle, Renderer } from 'pixi.js';
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
  private renderer: Renderer;

  constructor() {
    this.renderer = new Renderer({ width: imageWidth, height: imageHeight, antialias: true, background: 0xffffff });
    events.on('generateThumbnail', this.setThumbnailDirty);
  }

  setThumbnailDirty = () => {
    this.thumbnailDirty = true;
  };

  destroy() {
    events.off('generateThumbnail', this.setThumbnailDirty);
    this.renderer.destroy(false);
  }

  rendererBusy() {
    this.lastUpdate = performance.now();
  }

  async check() {
    if (this.thumbnailDirty && !pixiApp.copying) {
      const now = performance.now();
      // don't do anything while the app is paused (since it may already be generating thumbnails)
      if (now - this.lastUpdate > TIME_FOR_IDLE) {
        const url = window.location.pathname.split('/');
        const uuid = url[2];
        if (uuid) {
          debugTimeReset();
          this.generate().then((blob) => {
            if (blob) {
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
        this.lastUpdate = now;
      }
    }
  }

  /** returns a dataURL to a copy of the selected cells */
  private async generate(): Promise<Blob | null> {
    const rectangle = new Rectangle(0, 0, imageWidth, imageHeight);
    await pixiApp.prepareForCopying({ gridLines: true, cull: rectangle });
    pixiApp.gridLines.update(rectangle, undefined, true);
    this.renderer.render(pixiApp.viewportContents);
    pixiApp.cleanUpAfterCopying(true);
    pixiApp.gridLines.update(undefined, undefined, true);
    return new Promise((resolve) => {
      this.renderer.view.toBlob?.((blob) => resolve(blob));
    });
  }
}

export const thumbnail = new Thumbnail();
