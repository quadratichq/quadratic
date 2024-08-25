//! Draws grid lines on the canvas. The grid lines fade as the user zooms out,
//! and disappears at higher zoom levels. We remove lines between cells that
//! overflow (and in the future, merged cells).

import { Graphics, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { colors } from '../../theme/colors';
import { pixiApp } from '../pixiApp/PixiApp';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { calculateAlphaForGridLines } from './gridUtils';

interface GridLine {
  column?: number;
  row?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class GridLines extends Graphics {
  dirty = true;

  // cache of lines used for snapping
  gridLinesX: GridLine[] = [];
  gridLinesY: GridLine[] = [];

  draw(bounds: Rectangle): void {
    const range = this.drawHorizontalLines(bounds);
    this.drawVerticalLines(bounds, range);
    this.dirty = false;
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

      this.lineStyle({ width: 1, color: colors.gridLines, alignment: 0.5, native: true });
      this.gridLinesX = [];
      this.gridLinesY = [];
      const range = this.drawHorizontalLines(bounds);
      this.drawVerticalLines(bounds, range);
    }
  }

  private drawVerticalLines(bounds: Rectangle, range: [number, number]) {
    const offsets = sheets.sheet.offsets;
    const columnPlacement = offsets.getXPlacement(bounds.left);
    const index = columnPlacement.index;
    const position = columnPlacement.position;
    const gridOverflowLines = sheets.sheet.gridOverflowLines;

    let column = index;
    const offset = bounds.left - position;
    let size = 0;

    // draw negative space
    this.lineStyle({ width: 1, color: colors.gridLinesOutOfBounds, alignment: 0.5, native: true });
    let x = bounds.left;
    while (column < 0) {
      this.moveTo(x - offset, bounds.top);
      this.lineTo(x - offset, bounds.bottom);
      size = sheets.sheet.offsets.getColumnWidth(column);
      x += size;
      column++;
    }

    // draw positive space
    while (x < bounds.right + size - 1) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        const lines = gridOverflowLines.getLinesInRange(column, range);
        if (lines) {
          for (const [y0, y1] of lines) {
            const start = offsets.getRowPlacement(y0).position;
            const end = offsets.getRowPlacement(y1 + 1).position;
            this.moveTo(x - offset, start);
            this.lineTo(x - offset, end);
          }
        } else {
          if (bounds.top < 0) {
            this.lineStyle({ width: 1, color: colors.gridLinesOutOfBounds, alignment: 0.5, native: true });
            this.moveTo(x - offset, bounds.top);
            this.lineTo(x - offset, 0);
            this.lineStyle({ width: 1, color: colors.gridLines, alignment: 0.5, native: true });
            this.lineTo(x - offset, bounds.bottom);
            this.gridLinesX.push({ column, x: x - offset, y: 0, w: 1, h: bounds.bottom });
          } else {
            this.lineStyle({ width: 1, color: colors.gridLines, alignment: 0.5, native: true });
            this.moveTo(x - offset, bounds.top);
            this.lineTo(x - offset, bounds.bottom);
            this.gridLinesX.push({ column, x: x - offset, y: bounds.top, w: 1, h: bounds.bottom - bounds.top });
          }
        }
      }
      size = sheets.sheet.offsets.getColumnWidth(column);
      x += size;
      column++;
    }
  }

  // @returns the vertical range of [rowStart, rowEnd]
  private drawHorizontalLines(bounds: Rectangle): [number, number] {
    const offsets = sheets.sheet.offsets;
    const rowPlacement = offsets.getYPlacement(bounds.top);
    const index = rowPlacement.index;
    const position = rowPlacement.position;

    let row = index;
    const offset = bounds.top - position;
    let size = 0;

    // draw negative space
    this.lineStyle({ width: 1, color: colors.gridLinesOutOfBounds, alignment: 0.5, native: true });
    let y = bounds.top;
    while (row < 0) {
      this.moveTo(bounds.left, y - offset);
      this.lineTo(bounds.right, y - offset);
      size = offsets.getRowHeight(row);
      y += size;
      row++;
    }

    // draw positive space
    while (y < bounds.bottom + size - 1) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        if (bounds.left < 0) {
          this.lineStyle({ width: 1, color: colors.gridLinesOutOfBounds, alignment: 0.5, native: true });
          this.moveTo(bounds.left, y - offset);
          this.lineTo(0, y - offset);
          this.lineStyle({ width: 1, color: colors.gridLines, alignment: 0.5, native: true });
          this.lineTo(bounds.right, y - offset);
          this.gridLinesY.push({ row, x: 0, y: y - offset, w: 1, h: 1 });
        } else {
          this.lineStyle({ width: 1, color: colors.gridLines, alignment: 0.5, native: true });
          this.moveTo(bounds.left, y - offset);
          this.lineTo(bounds.right, y - offset);
          this.gridLinesY.push({ row, x: bounds.left, y: y - offset, w: bounds.right - bounds.left, h: 1 });
        }
      }
      size = offsets.getRowHeight(row);
      y += size;
      row++;
    }
    return [index, row - 1];
  }
}
