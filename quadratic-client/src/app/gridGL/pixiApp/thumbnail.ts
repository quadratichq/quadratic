import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { debugTimeCheck, debugTimeReset } from '@/app/gridGL/helpers/debugPerformance';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { apiClient } from '@/shared/api/apiClient';
import { Rectangle, Renderer } from 'pixi.js';

// This also needs to be changed in thumbnail.rs
const imageWidth = 1280;
const imageHeight = imageWidth / (16 / 9);

// time when renderer is not busy to perform an action
const TIME_FOR_IDLE = 3000;

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

  rendererBusy = () => {
    this.lastUpdate = performance.now();
  };

  check = async () => {
    if (
      this.thumbnailDirty &&
      !pixiApp.copying &&
      pixiAppSettings.editorInteractionState.transactionsInfo.length === 0
    ) {
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
                if (debugFlag('debugShowFileIO')) {
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
  };

  /** returns a dataURL to a copy of the selected cells */
  private generate = async (): Promise<Blob | null> => {
    const sheetId = sheets.getFirst().id;
    const rectangle = new Rectangle(0, 0, imageWidth, imageHeight);
    await content.prepareForCopying({ sheetId, cull: rectangle, gridLines: true, thumbnail: true });
    content.gridLines.update(rectangle, undefined, true);
    this.renderer.render(content);
    const viewportBounds = pixiApp.viewport.getVisibleBounds();
    content.cleanUpAfterCopying(viewportBounds);
    content.gridLines.update(undefined, undefined, true);
    return new Promise((resolve) => {
      this.renderer.view.toBlob?.((blob) => resolve(blob));
    });
  };
}

export const thumbnail = new Thumbnail();
