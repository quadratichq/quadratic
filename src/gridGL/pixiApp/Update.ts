import { Point } from 'pixi.js';
import { debugShowCellsForDirtyQuadrants, debugShowFPS, debugShowWhyRendering } from '../../debugFlags';
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
      window.dispatchEvent(new CustomEvent<number>('zoom-event', { detail: viewport.scale.x }));
    }
    if (this.lastViewportPosition.x !== viewport.x || this.lastViewportPosition.y !== viewport.y) {
      this.lastViewportPosition.x = viewport.x;
      this.lastViewportPosition.y = viewport.y;
      dirty = true;
    }
    if (dirty) this.pixiApp.viewportChanged();
  }

  // update loop w/debug checks
  private update = (timeStart: number): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;

    this.updateViewport();

    const rendererDirty =
      app.viewport.dirty ||
      app.gridLines.dirty ||
      app.axesLines.dirty ||
      app.headings.dirty ||
      app.cells.dirty ||
      app.cursor.dirty;

    if (rendererDirty && debugShowWhyRendering) {
      console.log(
        `dirty: ${app.viewport.dirty ? 'viewport ' : ''}${app.gridLines.dirty ? 'gridLines ' : ''}${
          app.axesLines.dirty ? 'axesLines ' : ''
        }${app.headings.dirty ? 'headings ' : ''}${app.cells.dirty ? 'cells ' : ''}${app.cursor.dirty ? 'cursor ' : ''}`
      );
    }

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

      // forces the temporary replacement cells to render instead of the cache or cells (used for debugging only)
      if (debugShowCellsForDirtyQuadrants) {
        app.quadrants.visible = false;
        const dirtyQuadrants = app.quadrants.getCellsForDirtyQuadrants();
        if (dirtyQuadrants) {
          app.cells.changeVisibility(true);
          app.cells.drawMultipleBounds(dirtyQuadrants.cellRectangles);
        }
      }

      // quadrant rendering
      else if (app.quadrants.visible) {
        const dirtyQuadrants = app.quadrants.getCellsForDirtyQuadrants();
        if (dirtyQuadrants) {
          app.cells.changeVisibility(true);
          app.cells.drawMultipleBounds(dirtyQuadrants.cellRectangles);
          app.cells.maskQuadrants(dirtyQuadrants.rectangles);
        } else {
          app.cells.maskQuadrants();
        }
      }

      // normal rendering
      else {
        app.cells.maskQuadrants();
      }

      debugTimeReset();
      app.renderer.render(app.stage);
      debugTimeCheck('[Update] render');
      this.nextQuadrantRender = performance.now() + QUADRANT_RENDER_WAIT;
      debugRendererLight(true);
      debugShowChildren(app.stage, 'stage');
      debugShowCachedCounts(app);
    } else {
      debugRendererLight(false);

      // only render quadrants when the viewport hasn't been dirty for a while
      if (timeStart > this.nextQuadrantRender) {
        app.quadrants.update(timeStart);
      }
    }

    this.raf = requestAnimationFrame(this.update);
    this.fps?.update();
  };
}
