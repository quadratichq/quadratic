import { Point } from 'pixi.js';
import { debug, debugShowCellsForDirtyQuadrants, debugShowFPS, debugShowWhyRendering } from '../../debugFlags';
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

  // used to avoid a hiccup on first user interaction
  private firstRender = false;

  // tracks whether quadrants were rendered last frame (after quadrants have finished rendering, we'll warm up real rendering by adding an additional render)
  private quadrantsRendered = false;

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
    if (dirty) this.pixiApp.viewportChanged();
  }

  // update loop w/debug checks
  private updateDebug = (timeStart: number): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;

    this.updateViewport();

    const rendererDirty =
      app.viewport.dirty ||
      app.gridLines.dirty ||
      app.axesLines.dirty ||
      app.headings.dirty ||
      app.boxCells.dirty ||
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
    app.boxCells.update();
    debugTimeCheck('[Update] boxCells');
    app.cells.update();

    debugTimeCheck('[Update] cells');
    app.cursor.update();
    debugTimeCheck('[Update] cursor');

    if (rendererDirty) {
      app.viewport.dirty = false;

      // not sure why this is needed, but avoids a slowdown on first interaction
      if (!this.firstRender) {
        this.firstRender = true;
        app.viewport.dirty = true;
      }

      // forces the temporary replacement cells to render instead of the cache or cells (used for debugging only)
      if (debugShowCellsForDirtyQuadrants) {
        app.quadrants.visible = false;
        const cellRectangles = app.quadrants.getCellsForDirtyQuadrants();
        app.cells.changeVisibility(true);
        app.cells.drawMultipleBounds(cellRectangles);
      }

      // normal rendering
      else if (app.quadrants.visible) {
        app.quadrants.cull();

        // forces real rendering for dirty quadrants
        const cellRectangles = app.quadrants.getCellsForDirtyQuadrants();
        if (cellRectangles.length) {
          app.cells.changeVisibility(true);
          app.cells.drawMultipleBounds(cellRectangles);
        } else {
          app.cells.changeVisibility(false);
        }
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
        if (app.quadrants.needsUpdating()) {
          this.quadrantsRendered = true;
          app.quadrants.update(timeStart);
        }

        // if quadrants are not dirty then rerender cells so it's ready for user input
        else if (this.quadrantsRendered) {
          app.cells.dirty = true;
          this.quadrantsRendered = false;
        }
      }
    }

    this.raf = requestAnimationFrame(this.updateDebug);
    this.fps?.update();
  };

  // update loop w/o debug checks
  private update = (timeStart: number): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;

    this.updateViewport();

    const rendererDirty =
      app.viewport.dirty ||
      app.gridLines.dirty ||
      app.axesLines.dirty ||
      app.headings.dirty ||
      app.boxCells.dirty ||
      app.cells.dirty ||
      app.cursor.dirty;

    app.gridLines.update();
    app.axesLines.update();
    app.headings.update();
    app.boxCells.update();
    app.cells.update();
    app.cursor.update();

    if (rendererDirty) {
      app.viewport.dirty = false;
      // not sure why this is needed, but avoids a slowdown on first interaction
      if (!this.firstRender) {
        this.firstRender = true;
        app.viewport.dirty = true;
      }

      if (app.quadrants.visible) {
        app.quadrants.cull();

        // forces real rendering for dirty quadrants
        const cellRectangles = app.quadrants.getCellsForDirtyQuadrants();
        if (cellRectangles.length) {
          app.cells.changeVisibility(true);
          app.cells.drawMultipleBounds(cellRectangles);
        } else {
          app.cells.changeVisibility(false);
        }
      }
      app.renderer.render(app.stage);
      this.nextQuadrantRender = performance.now() + QUADRANT_RENDER_WAIT;
    } else {
      // only render quadrants when the viewport hasn't been dirty for a while
      if (timeStart > this.nextQuadrantRender) {
        if (app.quadrants.needsUpdating()) {
          this.quadrantsRendered = true;
          app.quadrants.update(timeStart);
        }

        // if quadrants are not dirty then rerender cells so it's ready for user input
        else if (this.quadrantsRendered) {
          app.cells.dirty = true;
          this.quadrantsRendered = false;
        }
      }
    }

    this.raf = requestAnimationFrame(this.update);
  };
}
