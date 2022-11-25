import { debug, debugShowFPS } from '../../../debugFlags';
import {
  debugRendererLight,
  debugShowCachedCounts,
  debugShowChildren,
  debugTimeCheck,
  debugTimeReset,
} from '../helpers/debugPerformance';
import { FPS } from '../helpers/Fps';
import { QUADRANT_RENDER_WAIT } from '../quadrants/quadrantConstants';
import { PixiApp } from './PixiApp';

export class Update {
  private pixiApp: PixiApp;
  private raf?: number;
  private fps?: FPS;
  private nextQuadrantRender = 0;

  constructor(app: PixiApp) {
    this.pixiApp = app;
    if (debugShowFPS) {
      this.fps = new FPS();
    }
  }

  start(): void {
    if (!this.raf) {
      this.raf = requestAnimationFrame(debug ? this.updateDebug : this.update);
    }
  }

  destroy(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = undefined;
    }
  }

  private updateDebug = (timeStart: number): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;

    const rendererDirty =
      app.viewport.dirty ||
      app.gridLines.dirty ||
      app.axesLines.dirty ||
      app.headings.dirty ||
      app.cells.dirty ||
      app.cursor.dirty;

    debugTimeReset();
    app.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    app.axesLines.update();
    debugTimeCheck('[Update] axesLines');
    app.headings.update();
    debugTimeCheck('[Update] headings');
    app.cells.update();
    debugTimeCheck('[Update] cells');
    app.cursor.update();
    debugTimeCheck('[Update] cursor');

    if (rendererDirty) {
      app.viewport.dirty = false;

      if (app.quadrants.visible) {
        const cellRectangles = app.quadrants.getCellsForDirtyQuadrants();
        if (cellRectangles.length) {
          app.cells.visible = true;
          app.cells.drawMultipleBounds(cellRectangles);
        }
      }
      app.renderer.render(app.stage);
      this.nextQuadrantRender = performance.now() + QUADRANT_RENDER_WAIT;
      debugTimeCheck('[Update] render', 10);
      debugRendererLight(true);
      debugShowChildren(app.stage, 'stage');
      debugShowCachedCounts(app);
    } else {
      debugRendererLight(false);

      // only render quadrants when the viewport hasn't been dirty for a while
      if (timeStart > this.nextQuadrantRender) {
        if (app.quadrants.update(timeStart)) {
          app.renderer.render(app.stage);
        }
      }
    }

    this.raf = requestAnimationFrame(this.updateDebug);
    this.fps?.update();
  };

  private update = (timeStart: number): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;

    const rendererDirty =
      app.viewport.dirty ||
      app.gridLines.dirty ||
      app.axesLines.dirty ||
      app.headings.dirty ||
      app.cells.dirty ||
      app.cursor.dirty;

    app.gridLines.update();
    app.axesLines.update();
    app.headings.update();
    app.cells.update();
    app.cursor.update();

    if (rendererDirty) {
      app.viewport.dirty = false;
      app.renderer.render(app.stage);
      this.nextQuadrantRender = performance.now() + QUADRANT_RENDER_WAIT;
    } else {
      // only render quadrants when the viewport hasn't been dirty for a while
      if (timeStart > this.nextQuadrantRender) {
        if (app.quadrants.update(timeStart)) {
          app.renderer.render(app.stage);
        }
      }
    }

    this.raf = requestAnimationFrame(this.update);
  };
}
