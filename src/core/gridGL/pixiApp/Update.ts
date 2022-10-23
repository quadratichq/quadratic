import { AxesLines } from '../UI/AxesLines';
import { GridHeadings } from '../UI/gridHeadings/GridHeadings';
import { GridLines } from '../UI/GridLines';
import { PixiApp } from './PixiApp';

export class Update {
  private pixiApp: PixiApp;
  private raf?: number;
  private gridLines: GridLines;
  private axesLines: AxesLines;
  private headings: GridHeadings;

  constructor(app: PixiApp) {
    this.pixiApp = app;

    this.gridLines = app.viewport.addChild(new GridLines(app));
    this.axesLines = app.viewport.addChild(new AxesLines(app));
    this.headings = app.viewport.addChild(new GridHeadings(app));
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
    if (app.viewport.dirty) {
      app.viewport.dirty = false;

      if (app.dirty) {
        this.gridLines.update();
        this.axesLines.update();
      }

      // headings only update on change or if app.dirty is true
      this.headings.update(app.dirty);

      app.dirty = false;
      app.renderer.render(app.stage);
    }
    this.raf = requestAnimationFrame(this.update);
  }
}