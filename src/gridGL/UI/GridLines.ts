import { Graphics, Rectangle } from 'pixi.js';
import { calculateAlphaForGridLines } from './gridUtils';
import { colors } from 'theme/colors';
import { Table } from '../pixiApp/Table';
import { intersects } from 'gridGL/helpers/intersects';

export class GridLines extends Graphics {
  private table: Table;
  dirty = true;

  constructor(table: Table) {
    super();
    this.table = table;
  }

  draw(viewportBounds: Rectangle): void {
    this.lineStyle(1, colors.gridLines, 0.25, 0.5, true);
    const tableBounds = new Rectangle(this.table.x, this.table.y, this.table.actualWidth, this.table.actualHeight);
    this.drawVerticalLines(viewportBounds, tableBounds);
    this.drawHorizontalLines(viewportBounds, tableBounds);
    this.dirty = true;
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.clear();

      const { app } = this.table;

      if (!app.settings.showGridLines) {
        this.visible = false;
        this.table.app.setViewportDirty();
        return;
      }

      const gridAlpha = calculateAlphaForGridLines(app.viewport);
      if (gridAlpha === 0) {
        this.alpha = 0;
        this.visible = false;
        return;
      }

      this.alpha = gridAlpha;
      this.visible = true;

      this.lineStyle(1, colors.gridLines, 0.25, 0.5, true);
      const viewportBounds = app.viewport.getVisibleBounds();
      const tableBounds = new Rectangle(this.table.x, this.table.y, this.table.actualWidth, this.table.actualHeight);
      if (!intersects.rectangleRectangle(viewportBounds, tableBounds)) return;
      this.drawVerticalLines(viewportBounds, tableBounds);
      this.drawHorizontalLines(viewportBounds, tableBounds);
    }
  }

  // todo: use viewportBounds to limit drawing
  private drawVerticalLines(viewportBounds: Rectangle, tableBounds: Rectangle): void {
    const { gridOffsets } = this.table.sheet;
    const { index } = gridOffsets.getColumnIndex(viewportBounds.left);
    let column = index;
    // const offset = viewportBounds.left - position;
    let size = 0;
    const start = tableBounds.left;
    const end = tableBounds.right + size - 1;
    for (let x = start; x <= end; x += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        this.moveTo(x, tableBounds.top);
        this.lineTo(x, tableBounds.bottom);
      }
      size = gridOffsets.getColumnWidth(column);
      column++;
    }
  }

  // todo: use viewportBounds to limit drawing
  private drawHorizontalLines(viewportBounds: Rectangle, tableBounds: Rectangle): void {
    const { gridOffsets } = this.table.sheet;
    const { index } = gridOffsets.getRowIndex(viewportBounds.top);
    let row = index;
    // const offset = viewportBounds.top - position;
    let size = 0;
    const start = tableBounds.top; //Math.max(viewportBounds.top, tableBounds.top);
    const end = tableBounds.bottom + size - 1; //Math.min(viewportBounds.bottom + size - 1, tableBounds.bottom);
    for (let y = start; y <= end; y += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        this.moveTo(tableBounds.left, y);
        this.lineTo(tableBounds.right, y);
      }
      size = gridOffsets.getRowHeight(row);
      row++;
    }
  }
}
