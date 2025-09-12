//! Draws grid lines on the canvas. The grid lines fade as the user zooms out,
//! and disappears at higher zoom levels. We remove lines between cells that
//! overflow (and in the future, merged cells). Grid lines also respect the
//! sheet.clamp value.

import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { calculateAlphaForGridLines } from '@/app/gridGL/UI/gridUtils';
import { colors } from '@/app/theme/colors';
import type { ILineStyleOptions, Rectangle } from 'pixi.js';
import { Graphics } from 'pixi.js';

interface GridLine {
  column?: number;
  row?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class GridLines extends Graphics {
  currentLineStyle: ILineStyleOptions = { alpha: 0 };
  dirty = true;

  // cache of lines used for snapping
  gridLinesX: GridLine[] = [];
  gridLinesY: GridLine[] = [];

  constructor() {
    super();
    events.on('setDirty', this.setDirty);
  }

  destroy() {
    events.off('setDirty', this.setDirty);
    super.destroy();
  }

  private setDirty = (dirty: DirtyObject) => {
    if (dirty.gridLines) {
      this.dirty = true;
    }
  };

  update = (bounds = pixiApp.viewport.getVisibleBounds(), scale = pixiApp.viewport.scale.x, forceRefresh = false) => {
    if (!this.dirty && !forceRefresh) {
      return;
    }
    this.dirty = false;
    this.clear();

    if (!pixiAppSettings.showGridLines) {
      this.visible = false;
      pixiApp.setViewportDirty();
      return;
    }

    const gridAlpha = calculateAlphaForGridLines(scale);
    if (gridAlpha === 0) {
      this.visible = false;
      this.currentLineStyle = { alpha: 0 };
      return;
    }

    this.visible = true;

    this.currentLineStyle = {
      width: 1,
      color: colors.gridLines,
      alpha: 0.2 * gridAlpha,
      alignment: 0.5,
      native: true,
    };
    this.lineStyle(this.currentLineStyle);
    this.gridLinesX = [];
    this.gridLinesY = [];

    const range = this.drawHorizontalLines(bounds); //, this.getColumns(bounds));
    this.drawVerticalLines(bounds, range);
  };

  private drawVerticalLines(bounds: Rectangle, range: [number, number]) {
    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    const columnPlacement = offsets.getXPlacement(bounds.left);
    const index = columnPlacement.index;
    const position = columnPlacement.position;
    const gridOverflowLines = sheets.sheet.gridOverflowLines;

    const top = bounds.top <= sheet.clamp.top ? sheet.clamp.top : bounds.top;

    // draw 0-line if it's visible (since it's not part of the sheet anymore)
    if (bounds.left <= 0) {
      this.moveTo(0, top);
      this.lineTo(0, bounds.bottom);
    }

    let column = index;
    const offset = bounds.left - position;
    let size = 0;
    for (let x = bounds.left; x <= bounds.right + size - 1; x += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        const lines = gridOverflowLines.getColumnVerticalRange(column, range);
        if (lines) {
          for (const [y0, y1] of lines) {
            const start = offsets.getRowPlacement(y0).position;
            const end = offsets.getRowPlacement(y1 + 1).position;
            this.moveTo(x - offset, start);
            this.lineTo(x - offset, end);
          }
        } else {
          this.moveTo(x - offset, top);
          this.lineTo(x - offset, bounds.bottom);
        }
        this.gridLinesX.push({ column, x: x - offset, y: top, w: 1, h: bounds.bottom - top });
      }
      size = sheets.sheet.offsets.getColumnWidth(column);
      column++;
    }
  }

  // @returns the vertical range of [rowStart, rowEnd]
  private drawHorizontalLines(bounds: Rectangle): [number, number] {
    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    const startX = offsets.getColumnFromScreen(bounds.left);
    const endX = offsets.getColumnFromScreen(bounds.right);
    const rowPlacement = offsets.getYPlacement(bounds.top);
    const index = rowPlacement.index;
    const position = rowPlacement.position;
    const gridOverflowLines = sheets.sheet.gridOverflowLines;

    const left = bounds.left <= sheet.clamp.left ? sheet.clamp.left : bounds.left;

    // draw 0-line if it's visible (since it's not part of the sheet anymore)
    if (bounds.top <= sheet.clamp.top) {
      this.moveTo(left, 0);
      this.lineTo(bounds.right, 0);
    }

    let row = index;
    const offset = bounds.top - position;
    let size = 0;
    for (let y = bounds.top; y <= bounds.bottom + size - 1; y += size) {
      // don't draw grid lines when hidden
      if (size !== 0) {
        const lines = gridOverflowLines.getRowHorizontalRange(row, [startX, endX]);
        if (lines) {
          for (const [x0, x1] of lines) {
            const start = offsets.getColumnPlacement(x0).position;
            const end = offsets.getColumnPlacement(x1 + 1).position;
            this.moveTo(start, y - offset);
            this.lineTo(end, y - offset);
          }
        } else {
          this.moveTo(left, y - offset);
          this.lineTo(bounds.right, y - offset);
        }
        this.gridLinesY.push({ row, x: bounds.left, y: y - offset, w: bounds.right - left, h: 1 });
      }
      size = offsets.getRowHeight(row);
      row++;
    }
    return [index, row - 1];
  }
}
