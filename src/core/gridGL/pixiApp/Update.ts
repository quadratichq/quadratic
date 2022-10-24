import { PixiApp } from './PixiApp';

export class Update {
  private pixiApp: PixiApp;
  private raf?: number;

  constructor(app: PixiApp) {
    this.pixiApp = app;
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