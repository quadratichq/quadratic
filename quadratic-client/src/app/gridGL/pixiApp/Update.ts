import { Point } from 'pixi.js';

import { debugShowFPS, debugShowWhyRendering } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import {
  debugRendererLight,
  debugShowCachedCounts,
  debugShowChildren,
  debugTimeCheck,
  debugTimeReset,
} from '@/app/gridGL/helpers/debugPerformance';
import { FPS } from '@/app/gridGL/helpers/Fps';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { thumbnail } from '@/app/gridGL/pixiApp/thumbnail';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';

export class Update {
  private raf?: number;
  private fps?: FPS;
  private lastViewportPosition: Point = new Point();

  // setting this to 0 ensures that on initial render, the viewport is properly scaled and updated
  private lastViewportScale = 0;

  private lastScreenWidth = 0;
  private lastScreenHeight = 0;

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

  sendRenderViewport() {
    const bounds = pixiApp.viewport.getVisibleBounds();
    renderWebWorker.updateViewport(sheets.sheet.id, bounds);
  }

  updateViewport(): void {
    const { viewport } = pixiApp;
    let dirty = false;
    if (this.lastViewportScale !== viewport.scale.x) {
      this.lastViewportScale = viewport.scale.x;
      dirty = true;

      // this is used to trigger changes to ZoomDropdown
      events.emit('zoom', viewport.scale.x);
    }
    if (this.lastViewportPosition.x !== viewport.x || this.lastViewportPosition.y !== viewport.y) {
      this.lastViewportPosition.x = viewport.x;
      this.lastViewportPosition.y = viewport.y;
      dirty = true;
    }
    if (this.lastScreenWidth !== viewport.screenWidth || this.lastScreenHeight !== viewport.screenHeight) {
      this.lastScreenWidth = viewport.screenWidth;
      this.lastScreenHeight = viewport.screenHeight;
      dirty = true;
    }
    if (dirty) {
      pixiApp.viewportChanged();
      this.sendRenderViewport();
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

    let rendererDirty =
      pixiApp.gridLines.dirty ||
      pixiApp.axesLines.dirty ||
      pixiApp.headings.dirty ||
      pixiApp.boxCells.dirty ||
      pixiApp.multiplayerCursor.dirty ||
      pixiApp.cursor.dirty ||
      pixiApp.cellImages.dirty ||
      pixiApp.cellHighlights.isDirty() ||
      pixiApp.cellMoving.dirty ||
      pixiApp.cursor.dirty;

    if (rendererDirty && debugShowWhyRendering) {
      console.log(
        `dirty: ${pixiApp.viewport.dirty ? 'viewport ' : ''}${pixiApp.gridLines.dirty ? 'gridLines ' : ''}${
          pixiApp.axesLines.dirty ? 'axesLines ' : ''
        }${pixiApp.headings.dirty ? 'headings ' : ''}${pixiApp.cursor.dirty ? 'cursor ' : ''}${
          pixiApp.multiplayerCursor.dirty ? 'multiplayer cursor' : pixiApp.cellImages.dirty ? 'uiImageResize' : ''
        }
          ${pixiApp.multiplayerCursor.dirty ? 'multiplayer cursor' : ''}${pixiApp.cellMoving.dirty ? 'cellMoving' : ''}`
      );
    }

    debugTimeReset();
    pixiApp.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    pixiApp.axesLines.update();
    debugTimeCheck('[Update] axesLines');
    pixiApp.headings.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] headings');
    pixiApp.boxCells.update();
    debugTimeCheck('[Update] boxCells');
    pixiApp.cursor.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] cursor');
    pixiApp.cellHighlights.update();
    debugTimeCheck('[Update] cellHighlights');
    pixiApp.multiplayerCursor.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] multiplayerCursor');
    pixiApp.cellImages.update();
    debugTimeCheck('[Update] uiImageResize');
    pixiApp.cellMoving.update();
    debugTimeCheck('[Update] cellMoving');
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
      thumbnail.rendererBusy();
    } else {
      debugRendererLight(false);
      thumbnail.check();
    }

    this.raf = requestAnimationFrame(this.update);
    this.fps?.update();
  };
}
