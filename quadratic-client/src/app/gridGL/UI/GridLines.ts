//! Draws grid lines on the canvas. The grid lines fade as the user zooms out,
//! and disappears at higher zoom levels. We remove lines between cells that
//! overflow (and in the future, merged cells). Grid lines also respect the
//! sheet.clamp value.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { calculateAlphaForGridLines } from '@/app/gridGL/UI/gridUtils';
import { Container, Sprite, Texture, type ILineStyleOptions, type Rectangle } from 'pixi.js';

interface GridLine {
  column?: number;
  row?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRID_LINE_ALPHA = 0.1;

export class GridLines extends Container {
  currentLineStyle: ILineStyleOptions = { alpha: 0 };
  dirty = true;

  // cache of lines used for snapping
  gridLinesX: GridLine[] = [];
  gridLinesY: GridLine[] = [];

  current: number = 0;

  // line width that takes scale into account (so it always draws as 1 pixel)
  lineWidth: number = 1;

  constructor() {
    super();

    events.on('gridLinesDirty', this.setDirty);
  }

  destroy() {
    events.off('gridLinesDirty', this.setDirty);
    super.destroy();
  }

  setDirty = () => {
    this.dirty = true;
  };

  update = (bounds = pixiApp.viewport.getVisibleBounds(), scale = pixiApp.viewport.scale.x, forceRefresh = false) => {
    if (!this.dirty && !forceRefresh) {
      return;
    }

    this.dirty = false;

    if (!pixiAppSettings.showGridLines) {
      this.visible = false;
      pixiApp.setViewportDirty();
      return;
    }

    const gridAlpha = calculateAlphaForGridLines(scale);
    if (gridAlpha === 0) {
      this.visible = false;
      return;
    }

    this.current = 0;
    this.visible = true;
    this.alpha = gridAlpha * GRID_LINE_ALPHA;
    this.lineWidth = 1 / scale;

    // this.currentLineStyle = {
    //   width: 1,
    //   color: colors.gridLines,
    //   alpha: 0.2 * gridAlpha,
    //   alignment: 0.5,
    //   native: true,
    // };
    // this.lineStyle(this.currentLineStyle);
    this.gridLinesX = [];
    this.gridLinesY = [];

    const range = this.drawHorizontalLines(bounds);
    this.drawVerticalLines(bounds, range);

    this.hideRemainingLines();
  };

  private getLine(): Sprite {
    if (this.current >= this.children.length) {
      const line = this.addChild(new Sprite(Texture.WHITE));
      line.tint = 0;
      return line;
    } else {
      const line = this.children[this.current] as Sprite;
      line.visible = true;
      this.current++;
      return line;
    }
  }

  private drawHorizontalLine(x0: number, x1: number, y: number) {
    if (y + 1 < sheets.sheet.clamp.top) return;
    const line = this.getLine();
    line.position.set(x0, y - this.lineWidth / 2);
    line.width = x1 - x0;
    line.height = this.lineWidth;
    return line;
  }

  private drawVerticalLine(y0: number, y1: number, x: number) {
    if (x + 1 < sheets.sheet.clamp.left) return;
    const line = this.getLine();
    line.position.set(x - this.lineWidth / 2, y0 - this.lineWidth / 2);
    line.width = this.lineWidth;
    line.height = y1 - y0;
    return line;
  }

  private hideRemainingLines() {
    for (let i = this.current; i < this.children.length; i++) {
      this.children[i].visible = false;
    }
  }

  private drawVerticalLines(bounds: Rectangle, range: [number, number]) {
    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    const columnPlacement = offsets.getXPlacement(bounds.left);
    const startColumn = columnPlacement.index;
    const gridOverflowLines = sheets.sheet.gridOverflowLines;
    const top = bounds.top <= sheet.clamp.top ? sheet.clamp.top : bounds.top;

    // draw 0-line if it's visible (since it's not part of the sheet anymore)
    if (bounds.left <= 0) {
      this.drawVerticalLine(top, bounds.bottom, 0);
    }

    let column = startColumn;
    let currentColumnPosition = columnPlacement.position;

    // Draw lines for columns that are visible in the bounds
    while (currentColumnPosition <= bounds.right) {
      const columnWidth = offsets.getColumnWidth(column);

      // Only draw if column has width (not hidden)
      if (columnWidth > 0) {
        const lines = gridOverflowLines.getColumnVerticalRange(column, range);
        if (lines) {
          for (const [y0, y1] of lines) {
            const start = offsets.getRowPlacement(y0).position;
            const end = offsets.getRowPlacement(y1 + 1).position;
            this.drawVerticalLine(start, end, currentColumnPosition);
          }
        } else {
          this.drawVerticalLine(top, bounds.bottom, currentColumnPosition);
        }
        this.gridLinesX.push({
          column,
          x: currentColumnPosition,
          y: top,
          w: 1,
          h: bounds.bottom - top,
        });
      }

      currentColumnPosition += columnWidth;
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
      this.drawHorizontalLine(left, bounds.right, 0);
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
            this.drawHorizontalLine(start, end, y - offset);
          }
        } else {
          this.drawHorizontalLine(left, bounds.right, y - offset);
        }
        this.gridLinesY.push({ row, x: bounds.left, y: y - offset, w: bounds.right - left, h: 1 });
      }
      size = offsets.getRowHeight(row);
      row++;
    }
    return [index, row - 1];
  }
}
