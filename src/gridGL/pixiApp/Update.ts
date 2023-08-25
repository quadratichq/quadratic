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
import { PixiApp } from './PixiApp';

export class Update {
  private pixiApp: PixiApp;
  private raf?: number;
  private fps?: FPS;
  private lastViewportPosition: Point = new Point();
  private lastViewportScale = 1;

  constructor(app: PixiApp) {
    this.pixiApp = app;
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
    const { viewport } = this.pixiApp;
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
      this.pixiApp.viewportChanged();
    }
  }

  // update loop w/debug checks
  private update = (): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;

    if (app.paused) {
      this.raf = requestAnimationFrame(this.update);
      this.fps?.update();
      return;
    }

    this.updateViewport();

    const rendererDirty =
      app.viewport.dirty ||
      app.gridLines.dirty ||
      app.axesLines.dirty ||
      app.headings.dirty ||
      app.boxCells.dirty ||
      app.cursor.dirty;

    if (rendererDirty && debugShowWhyRendering) {
      console.log(
        `dirty: ${app.viewport.dirty ? 'viewport ' : ''}${app.gridLines.dirty ? 'gridLines ' : ''}${
          app.axesLines.dirty ? 'axesLines ' : ''
        }${app.headings.dirty ? 'headings ' : ''}${app.cursor.dirty ? 'cursor ' : ''}`
      );
    }

    debugTimeReset();
    app.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    app.axesLines.update();
    debugTimeCheck('[Update] axesLines');
    app.headings.update();
    debugTimeCheck('[Update] headings');
    app.boxCells.update();
    debugTimeCheck('[Update] boxCells');
    app.cursor.update();
    debugTimeCheck('[Update] cursor');

    if (rendererDirty) {
      app.viewport.dirty = false;

      debugTimeReset();
      app.cellsSheets.update();
      app.renderer.render(app.stage);
      debugTimeCheck('[Update] render');
      debugRendererLight(true);
      debugShowChildren(app.stage, 'stage');
      debugShowCachedCounts(app);
    } else {
      debugRendererLight(false);
    }

    this.raf = requestAnimationFrame(this.update);
    this.fps?.update();
  };
}
