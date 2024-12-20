import { debugShowFPS, debugShowWhyRendering } from '../../debugFlags';
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

export class Update {
  private raf?: number;
  private fps?: FPS;

  firstRenderComplete = false;

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

<<<<<<< HEAD
  sendRenderViewport() {
    const bounds = pixiApp.viewport.getVisibleBounds();
    const scale = pixiApp.viewport.scale.x;
    renderWebWorker.updateViewport(sheets.sheet.id, bounds, scale);
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
    if (this.lastSheetId !== sheets.sheet.id) {
      this.lastSheetId = sheets.sheet.id;
      dirty = true;
    }
    if (dirty) {
      pixiApp.viewportChanged();
      this.sendRenderViewport();

      // signals to react that the viewport has changed (so it can update any
      // related positioning)
      events.emit('viewportChangedReady');
    }
  }

=======
>>>>>>> origin/qa
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
    pixiApp.viewport.updateViewport();

    let rendererDirty =
      pixiApp.gridLines.dirty ||
      pixiApp.headings.dirty ||
      pixiApp.boxCells.dirty ||
      pixiApp.multiplayerCursor.dirty ||
      pixiApp.cursor.dirty ||
      pixiApp.cellImages.dirty ||
      pixiApp.cellHighlights.isDirty() ||
      pixiApp.cellMoving.dirty ||
      pixiApp.validations.dirty;

    if (rendererDirty && debugShowWhyRendering) {
      console.log(
        `dirty: ${[
          pixiApp.viewport.dirty && 'viewport',
          pixiApp.gridLines.dirty && 'gridLines',
          pixiApp.headings.dirty && 'headings',
          pixiApp.boxCells.dirty && 'boxCells',
          pixiApp.multiplayerCursor.dirty && 'multiplayerCursor',
          pixiApp.cursor.dirty && 'cursor',
          pixiApp.cellImages.dirty && 'cellImages',
          pixiApp.cellHighlights.isDirty() && 'cellHighlights',
          pixiApp.cellMoving.dirty && 'cellMoving',
          pixiApp.validations.dirty && 'validations',
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }

    debugTimeReset();
    pixiApp.gridLines.update();
    debugTimeCheck('[Update] gridLines');
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
    pixiApp.cellsSheets.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] cellsSheets');
    pixiApp.validations.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] backgrounds');
    pixiApp.background.update(pixiApp.viewport.dirty);

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

    if (!this.firstRenderComplete) {
      this.firstRenderComplete = true;
      pixiApp.viewport.loadViewport();
    }

    this.raf = requestAnimationFrame(this.update);
    this.fps?.update();
  };
}
