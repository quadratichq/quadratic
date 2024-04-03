import { Graphics, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { colors } from '../../theme/colors';
import { pixiApp } from '../pixiApp/PixiApp';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { calculateAlphaForGridLines } from './gridUtils';

export class GridLines extends Graphics {
  dirty = true;

  // cache of lines used for snapping
  gridLinesX: { x: number; y: number; w: number; h: number }[] = [];
  gridLinesY: { x: number; y: number; w: number; h: number }[] = [];

  draw(bounds: Rectangle): void {
    this.lineStyle(1, colors.gridLines, 0.125, 0.5, true);
    this.drawVerticalLines(bounds);
    this.drawHorizontalLines(bounds);
    this.dirty = true;
  }

  update(bounds = pixiApp.viewport.getVisibleBounds(), scale = pixiApp.viewport.scale.x, forceRefresh = false) {
    if (this.dirty || forceRefresh) {
      this.dirty = false;
      this.clear();

      if (!pixiAppSettings.showGridLines) {
        this.visible = false;
        pixiApp.setViewportDirty();
        return;
      }

      const gridAlpha = calculateAlphaForGridLines(scale);
      if (gridAlpha === 0) {
        this.alpha = 0;
        this.visible = false;
        return;
      }

      this.alpha = gridAlpha;
      this.visible = true;

      this.lineStyle(1, colors.gridLines, 0.125, 0.5, true);
      this.gridLinesX = [];
      this.gridLinesY = [];
      this.drawVerticalLines(bounds);
      this.drawHorizontalLines(bounds);
    }
  }

  private drawVerticalLines(bounds: Rectangle): void {
    const offsets = sheets.sheet.offsets;
    const columnPlacement = offsets.getXPlacement(bounds.left);
    const index = columnPlacement.index;
    const position = columnPlacement.position;

    let column = index;
    const offset = bounds.left - position;
    let size = 0;
    for (let x = bounds.left; x <= bounds.right + size - 1; x += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        this.moveTo(x - offset, bounds.top);
        this.lineTo(x - offset, bounds.bottom);
        this.gridLinesX.push({ x: x - offset, y: bounds.top, w: 1, h: bounds.bottom - bounds.top });
      }
      size = sheets.sheet.offsets.getColumnWidth(column);
      column++;
    }
  }

  private drawHorizontalLines(bounds: Rectangle): void {
    const offsets = sheets.sheet.offsets;
    const rowPlacement = offsets.getYPlacement(bounds.top);
    const index = rowPlacement.index;
    const position = rowPlacement.position;

    let row = index;
    const offset = bounds.top - position;
    let size = 0;
    for (let y = bounds.top; y <= bounds.bottom + size - 1; y += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        this.moveTo(bounds.left, y - offset);
        this.lineTo(bounds.right, y - offset);
        this.gridLinesY.push({ x: bounds.left, y: y - offset, w: bounds.right - bounds.left, h: 1 });
      }
      size = offsets.getRowHeight(row);
      row++;
    }
  }
}
