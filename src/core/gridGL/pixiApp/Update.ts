import { debug, debugShowFPS, debugShowRenderer } from '../../../debugFlags';
import { timeCheck, timeReset } from '../helpers/debugPerformance';
import { FPS } from './Fps';
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

  private setDebugShowRenderer(on: boolean): void {
    const span = document.querySelector('.debug-show-renderer') as HTMLSpanElement;
    if (span) {
      span.style.backgroundColor = on ? '#aa0000' : '#00aa00';
    }
  }

  private updateDebug = (): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;
    const rendererDirty = app.viewport.dirty || app.gridLines.dirty || app.axesLines.dirty || app.headings.dirty || app.cells.dirty || app.cursor.dirty;

    timeReset()
    app.gridLines.update();
    timeCheck('gridLines');
    app.axesLines.update();
    timeCheck('axesLines');
    app.headings.update();
    timeCheck('headings');
    app.cells.update();
    timeCheck('cells');
    app.cursor.update();
    timeCheck('cursor');

    if (rendererDirty) {
      app.viewport.dirty = false;
      app.renderer.render(app.stage);
      timeCheck('render', 10);
      if (debugShowRenderer) {
        this.setDebugShowRenderer(true);
      }
    } else {
      if (debugShowRenderer) {
        this.setDebugShowRenderer(false);
      }
    }
    this.raf = requestAnimationFrame(this.updateDebug);
    this.fps?.update();
  }

  private update = (): void => {
    const app = this.pixiApp;
    if (app.destroyed) return;
    const rendererDirty = app.viewport.dirty || app.gridLines.dirty || app.axesLines.dirty || app.headings.dirty || app.cells.dirty || app.cursor.dirty;

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
  }
}