import { Point } from 'pixi.js';
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
  private lastViewportPosition: Point = new Point();

  // setting this to 0 ensures that on initial render, the viewport is properly scaled and updated
  private lastViewportScale = 0;

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
      pixiApp.multiplayerCursor.dirty ||
      pixiApp.cursor.dirty;

    if (rendererDirty && debugShowWhyRendering) {
      console.log(
        `dirty: ${pixiApp.viewport.dirty ? 'viewport ' : ''}${pixiApp.gridLines.dirty ? 'gridLines ' : ''}${
          pixiApp.axesLines.dirty ? 'axesLines ' : ''
        }${pixiApp.headings.dirty ? 'headings ' : ''}${pixiApp.cursor.dirty ? 'cursor ' : ''}${
          pixiApp.multiplayerCursor.dirty ? 'multiplayer cursor' : ''
        }`
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
    pixiApp.multiplayerCursor.update();
    debugTimeCheck('[Update] multiplayerCursor');
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
