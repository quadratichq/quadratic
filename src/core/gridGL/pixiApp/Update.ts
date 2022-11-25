import { debug, debugShowFPS } from '../../../debugFlags';
import {
  debugRendererLight,
  debugShowCachedCounts,
  debugShowChildren,
  debugTimeCheck,
  debugTimeReset,
} from '../helpers/debugPerformance';
import { FPS } from '../helpers/Fps';
import { PixiApp } from './PixiApp';

export class Update {
  private pixiApp: PixiApp;
  private raf?: number;
  private fps?: FPS;

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

  private updateDebug = (): void => {
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
    debugTimeCheck('gridLines');
    app.axesLines.update();
    debugTimeCheck('axesLines');
    app.headings.update();
    debugTimeCheck('headings');
    app.cells.update();
    debugTimeCheck('cells');
    app.cursor.update();
    debugTimeCheck('cursor');

    if (rendererDirty) {
      app.viewport.dirty = false;
      app.renderer.render(app.stage);
      debugTimeCheck('render', 10);
      debugRendererLight(true);
      debugShowChildren(app.stage, 'stage');
      debugShowCachedCounts(app);
    } else {
      debugRendererLight(false);
    }
    this.raf = requestAnimationFrame(this.updateDebug);
    this.fps?.update();
  };

  private update = (): void => {
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
    }
    this.raf = requestAnimationFrame(this.update);
  };
}
