import { InteractivePointerEvent, Point } from 'pixi.js';
import { PixiApp } from '../pixiApp/PixiApp';

export class HeadingResize {
  private app: PixiApp;
  private active = false;

  constructor(app: PixiApp) {
    this.app = app;
  }

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    if (event.shiftKey) return false;
    const { headings, gridOffsets } = this.app;
    const headingResize = headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      gridOffsets.headingResizing = {
        x: world.x,
        y: world.y,
        start: headingResize.start,
        row: headingResize.row,
        column: headingResize.column,
        width: headingResize.width,
        height: headingResize.height,
      };
      this.active = true;
      return true;
    }
    return false;
  }

  pointerMove(world: Point): boolean {
    const { canvas, headings } = this.app;
    const headingResize = headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      canvas.style.cursor = headingResize.column !== undefined ? "col-resize" : "row-resize";
    } else {
      canvas.style.cursor = headings.intersectsHeadings(world) ? 'pointer' : 'auto';
    }
    if (!this.active) {
      return false;
    }

    return true;
  }

  pointerUp(): boolean {
    if (this.active) {
      this.active = false;
      return true;
    }
    return false;
  }
}