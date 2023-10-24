import { Point } from 'pixi.js';
import { apiClient } from '../../api/apiClient';
import { debugShowFPS, debugShowWhyRendering } from '../../debugFlags';
import { grid } from '../../grid/controller/Grid';
import { FPS } from '../helpers/Fps';
import {
  debugRendererLight,
  debugShowCachedCounts,
  debugShowChildren,
  debugTimeCheck,
  debugTimeReset,
} from '../helpers/debugPerformance';
import { pixiApp } from './PixiApp';
import { thumbnail } from './thumbnail';

// time when renderer is not busy to perform an action
const TIME_FOR_IDLE = 1000;

export class Update {
  private raf?: number;
  private fps?: FPS;
  private lastViewportPosition: Point = new Point();
  private lastViewportScale = 1;
  private lastUpdate = 0;

  constructor() {
    if (debugShowFPS) {
      this.fps = new FPS();
    }
  }

  start(): void {
    if (!this.raf) {
      this.raf = requestAnimationFrame(this.update);
    }
  }

  destroy(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = undefined;
    }
  }

  private updateViewport(): void {
    const { viewport } = pixiApp;
    let dirty = false;
    if (this.lastViewportScale !== viewport.scale.x) {
      this.lastViewportScale = viewport.scale.x;
      dirty = true;

      // this is used to trigger changes to ZoomDropdown
      window.dispatchEvent(new CustomEvent<number>('zoom-event', { detail: viewport.scale.x }));
    }
    if (this.lastViewportPosition.x !== viewport.x || this.lastViewportPosition.y !== viewport.y) {
      this.lastViewportPosition.x = viewport.x;
      this.lastViewportPosition.y = viewport.y;
      dirty = true;
    }
    if (dirty) {
      pixiApp.viewportChanged();
    }
  }

  // update loop w/debug checks
  private update = (): void => {
    if (pixiApp.destroyed) return;

    if (pixiApp.paused) {
      this.raf = requestAnimationFrame(this.update);
      this.fps?.update();
      return;
    }

    if (!pixiApp.cellsSheets.isReady()) {
      this.raf = requestAnimationFrame(this.update);
      return;
    }

    this.updateViewport();

    const rendererDirty =
      pixiApp.gridLines.dirty ||
      pixiApp.axesLines.dirty ||
      pixiApp.headings.dirty ||
      pixiApp.boxCells.dirty ||
      pixiApp.cursor.dirty;

    if (rendererDirty && debugShowWhyRendering) {
      console.log(
        `dirty: ${pixiApp.viewport.dirty ? 'viewport ' : ''}${pixiApp.gridLines.dirty ? 'gridLines ' : ''}${
          pixiApp.axesLines.dirty ? 'axesLines ' : ''
        }${pixiApp.headings.dirty ? 'headings ' : ''}${pixiApp.cursor.dirty ? 'cursor ' : ''}`
      );
    }

    debugTimeReset();
    pixiApp.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    pixiApp.axesLines.update();
    debugTimeCheck('[Update] axesLines');
    pixiApp.headings.update();
    debugTimeCheck('[Update] headings');
    pixiApp.boxCells.update();
    debugTimeCheck('[Update] boxCells');
    pixiApp.cursor.update();
    debugTimeCheck('[Update] cursor');
    debugTimeReset();
    pixiApp.cellsSheets.update();
    debugTimeCheck('[Update] cellsSheets');

    if (pixiApp.viewport.dirty || rendererDirty) {
      debugTimeReset();
      pixiApp.viewport.dirty = false;
      pixiApp.renderer.render(pixiApp.stage);
      debugTimeCheck('[Update] render');

      debugRendererLight(true);
      debugShowChildren(pixiApp.stage, 'stage');
      debugShowCachedCounts();
      this.lastUpdate = performance.now();
    } else {
      debugRendererLight(false);
      const now = performance.now();
      if (this.lastUpdate + TIME_FOR_IDLE > now) {
        if (grid.thumbnailDirty) {
          const url = window.location.pathname.split('/');
          const uuid = url[2];
          if (uuid) {
            thumbnail().then((blob) => {
              if (blob) {
                apiClient.updateFilePreview(uuid, blob);
              }
            });
            console.log('[Thumbnail] Updated.');
            grid.thumbnailDirty = false;
          }
        }
        this.lastUpdate = performance.now();
      }
    }

    this.raf = requestAnimationFrame(this.update);
    this.fps?.update();
  };
}
