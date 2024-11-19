import { sheets } from '@/app/grid/controller/Sheets';
import { ColumnRowCursor } from '@/app/grid/sheet/SheetCursor';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { CellRefRange } from '@/app/quadratic-core-types';
import { Selection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Graphics } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';

const drawCursorOutline = (g: Graphics, color: number) => {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor.position;
  const outline = sheet.getCellOffsets(cursor.x, cursor.y);
  g.lineStyle({ width: CURSOR_THICKNESS, color, alignment: 0 });
  g.drawRect(outline.x, outline.y, outline.width, outline.height);
};

// this is generic so it can be used by UIMultiplayerCursor
export const drawColumnRowCursor = (options: {
  g: Graphics;
  cursorPosition: Coordinate;
  columnRow: ColumnRowCursor;
  color: number;
  alpha: number;
}) => {
  const { g, cursorPosition, columnRow, color, alpha } = options;
  const sheet = sheets.sheet;

  g.lineStyle();
  g.beginFill(color, alpha);
  const bounds = pixiApp.viewport.getVisibleBounds();
  if (columnRow.all) {
    g.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
  } else {
    if (columnRow.columns) {
      let minX = Infinity,
        maxX = -Infinity;
      columnRow.columns.forEach((column) => {
        const { x, width } = sheet.getCellOffsets(column, 0);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + width);
        g.drawRect(x, bounds.y, width, bounds.height);
        if (column === cursorPosition.x) {
        }
      });

      // draw outline
      g.lineStyle(1, color, 1, 0, true);
      g.moveTo(minX, bounds.top);
      g.lineTo(minX, bounds.bottom);
      g.moveTo(maxX, bounds.top);
      g.lineTo(maxX, bounds.bottom);
    }
    if (columnRow.rows) {
      let minY = Infinity,
        maxY = -Infinity;
      columnRow.rows.forEach((row) => {
        const { y, height } = sheet.getCellOffsets(0, row);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + height);
        g.drawRect(bounds.x, y, bounds.width, height);
        if (row === cursorPosition.y) {
        }
      });

      // draw outline
      g.lineStyle(1, color, 1, 0, true);
      g.moveTo(bounds.left, minY);
      g.lineTo(bounds.right, minY);
      g.moveTo(bounds.left, maxY);
      g.lineTo(bounds.right, maxY);
    }
  }
  g.endFill();
  drawCursorOutline(g, color);
};

export const drawMultiCursor = (g: Graphics, color: number, alpha: number, selection: Selection) => {
  g.lineStyle(1, color, 1, 0, true);
  g.beginFill(color, alpha);

  const rangesStringified = selection.getRanges();
  let ranges: CellRefRange[] | undefined;
  try {
    ranges = JSON.parse(rangesStringified);
  } catch (e) {
    throw new Error('Failed to parse ranges in drawMultiCursor');
  }

  const sheet = sheets.sheet;
  ranges?.forEach((range) => {
    // we have all four points, just draw a rectangle
    const { col, row } = range.start;
    const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;

    // we have all four points, just draw a rectangle
    if (col && row && end?.col && end?.row) {
      const rect = sheet.getScreenRectangle(
        Number(col.coord),
        Number(row.coord),
        Number(end.col.coord) - 1,
        Number(end.row.coord) - 1
      );
      g.drawShape(rect);
    }

    // we only have one point, draw a single cell
    else if (col && row && !end) {
      const rect = sheet.getScreenRectangle(Number(col.coord), Number(row.coord), 0, 0);
      g.drawShape(rect);
    } else {
      throw new Error('todo: drawCursor needs to handle rows, columns, and all');
    }
  });
  g.endFill();
};
