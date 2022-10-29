import { Graphics, Rectangle } from 'pixi.js';
import { calculateAlphaForGridLines } from './gridUtils';
import { colors } from '../../../theme/colors';
import { PixiApp } from '../pixiApp/PixiApp';

export class GridLines extends Graphics {
  private app: PixiApp;
  dirty = true;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      if (!this.app.settings.showGridLines) {
        this.visible = false;
        return;
      }

      const gridAlpha = calculateAlphaForGridLines(this.app.viewport);
      if (gridAlpha === 0) {
        this.visible = false;
        return;
      }

      this.alpha = gridAlpha;
      this.visible = true;
      this.clear();

      this.lineStyle(1, colors.gridLines, 0.25, 0.5, true);
      const bounds = this.app.viewport.getVisibleBounds();
      this.drawVerticalLines(bounds);
      this.drawHorizontalLines(bounds);
    }
  }

  private drawVerticalLines(bounds: Rectangle): void {
    const { index, position } = this.app.gridOffsets.getColumnIndex(bounds.left);
    let column = index;
    const offset = bounds.left - position;
    let size = 0;
    for (let x = bounds.left; x <= bounds.right; x += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        this.moveTo(x - offset, bounds.top);
        this.lineTo(x - offset, bounds.bottom);
      }
      size = this.app.gridOffsets.getColumnWidth(column);
      column++;
    }
  }

  private drawHorizontalLines(bounds: Rectangle): void {
    const { index, position } = this.app.gridOffsets.getRowIndex(bounds.top);
    let row = index;
    const offset = bounds.top - position;
    let size = 0;
    for (let y = bounds.top; y <= bounds.bottom; y += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        this.moveTo(bounds.left, y - offset);
        this.lineTo(bounds.right, y - offset);
      }
      size = this.app.gridOffsets.getRowHeight(row);
      row++;
    }
  }
}
