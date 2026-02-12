//! Draws grid lines on the canvas. The grid lines fade as the user zooms out,
//! and disappears at higher zoom levels. We remove lines between cells that
//! overflow and merged cells. Grid lines also respect the sheet.clamp value.

import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import {
  calculateAlphaForGridLines,
  getColumnVerticalRangesToDraw,
  getMergedCellExcludedColumnsForRow,
  getMergedCellExcludedRowsForColumn,
  getRowHorizontalRangesToDraw,
} from '@/app/gridGL/UI/gridUtils';
import type { Rect } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import type { ILineStyleOptions } from 'pixi.js';
import { Graphics, Rectangle } from 'pixi.js';

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
    events.on('mergeCells', this.onMergeCellsChanged);
  }

  destroy() {
    events.off('setDirty', this.setDirty);
    events.off('mergeCells', this.onMergeCellsChanged);
    super.destroy();
  }

  private setDirty = (dirty: DirtyObject) => {
    if (dirty.gridLines) {
      this.dirty = true;
    }
  };

  private onMergeCellsChanged = (sheetId: string) => {
    if (sheetId === sheets.current) {
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

    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    const startCol = offsets.getColumnFromScreen(bounds.left);
    const endCol = offsets.getColumnFromScreen(bounds.right);
    const startRow = offsets.getRowFromScreen(bounds.top);
    const endRow = offsets.getRowFromScreen(bounds.bottom);
    const cellBounds = new Rectangle(startCol, startRow, endCol - startCol + 1, endRow - startRow + 1);
    const mergedRects = sheet.getMergeCellsInRect(cellBounds);

    const range = this.drawHorizontalLines(bounds, mergedRects, startCol, endCol);
    this.drawVerticalLines(bounds, range, mergedRects, startRow, endRow);
  };

  private drawVerticalLines(
    bounds: Rectangle,
    range: [number, number],
    mergedRects: Rect[],
    startRow: number,
    endRow: number
  ) {
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
      if (size !== 0 && x >= sheet.clamp.left) {
        // Get overflow lines (excludes overflow areas)
        const overflowLines = gridOverflowLines.getColumnVerticalRange(column, range);

        // Precalculate excluded row ranges due to merged cells
        // Use the full visible row range, not just 'range' from horizontal lines
        const mergedExcludedRows = getMergedCellExcludedRowsForColumn(column, [startRow, endRow], mergedRects);

        // Get the full row range for this column
        const topRow = offsets.getRowFromScreen(top);
        const bottomRow = offsets.getRowFromScreen(bounds.bottom);
        const fullRowRange: [number, number] = [topRow, bottomRow];

        // Compute ranges to draw, combining overflow and merged cell exclusions
        // Follows the same pattern as GridOverflowLines
        const linesToDraw = getColumnVerticalRangesToDraw(column, fullRowRange, overflowLines, mergedExcludedRows);

        // Draw the calculated line segments
        if (linesToDraw && linesToDraw.length > 0) {
          for (const [y0, y1] of linesToDraw) {
            const start = offsets.getRowPlacement(y0).position;
            const end = offsets.getRowPlacement(y1 + 1).position;
            this.moveTo(x - offset, start);
            this.lineTo(x - offset, end);
          }
        } else if (linesToDraw === undefined) {
          // No exclusions, draw the full line
          this.moveTo(x - offset, top);
          this.lineTo(x - offset, bounds.bottom);
        }
        // If linesToDraw is empty array, don't draw anything

        this.gridLinesX.push({ column, x: x - offset, y: top, w: 1, h: bounds.bottom - top });
      }
      size = sheets.sheet.offsets.getColumnWidth(column);
      column++;
    }
  }

  // @returns the vertical range of [rowStart, rowEnd]
  private drawHorizontalLines(
    bounds: Rectangle,
    mergedRects: Rect[],
    startCol: number,
    endCol: number
  ): [number, number] {
    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
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
      if (size !== 0 && y >= sheet.clamp.top) {
        // Get overflow lines (excludes overflow areas)
        const overflowLines = gridOverflowLines.getRowHorizontalRange(row, [startCol, endCol]);

        // Precalculate excluded column ranges due to merged cells
        const mergedExcludedCols = getMergedCellExcludedColumnsForRow(row, [startCol, endCol], mergedRects);

        // Compute ranges to draw, combining overflow and merged cell exclusions
        // Follows the same pattern as GridOverflowLines
        const linesToDraw = getRowHorizontalRangesToDraw(row, [startCol, endCol], overflowLines, mergedExcludedCols);

        // Draw the calculated line segments
        if (linesToDraw && linesToDraw.length > 0) {
          for (const [x0, x1] of linesToDraw) {
            const start = offsets.getColumnPlacement(x0).position;
            const end = offsets.getColumnPlacement(x1 + 1).position;
            this.moveTo(start, y - offset);
            this.lineTo(end, y - offset);
          }
        } else if (linesToDraw === undefined) {
          // No exclusions, draw the full line
          this.moveTo(left, y - offset);
          this.lineTo(bounds.right, y - offset);
        }
        // If linesToDraw is empty array, don't draw anything

        this.gridLinesY.push({ row, x: bounds.left, y: y - offset, w: bounds.right - left, h: 1 });
      }
      size = offsets.getRowHeight(row);
      row++;
    }
    return [index, row - 1];
  }
}
