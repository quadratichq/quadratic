//! Generic draw cursor functions that is used by both Cursor.ts and
//! UIMultiplayerCursor.ts.

import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { CellRefRange } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Graphics } from 'pixi.js';

export const drawCursorOutline = (g: Graphics, color: number, cursor: Coordinate) => {
  const outline = sheets.sheet.getCellOffsets(cursor.x, cursor.y);
  g.lineStyle({ width: CURSOR_THICKNESS, color, alignment: 0 });
  g.drawRect(outline.x, outline.y, outline.width, outline.height);
};

// Draws a cursor with a finite number of cells (this is drawn once for each
// selection setting).
export const drawFiniteCursor = (g: Graphics, color: number, alpha: number, ranges: CellRefRange[]) => {
  g.lineStyle(1, color, 1, 0, true);
  g.beginFill(color, alpha);

  const sheet = sheets.sheet;
  ranges.forEach((range) => {
    const { col, row } = range.start;
    const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;

    // we have all four points, just draw a rectangle
    if (col && row && end?.col && end?.row) {
      const rect = sheet.getScreenRectangle(
        Number(col.coord),
        Number(row.coord),
        Number(end.col.coord) - Number(col.coord) + 1,
        Number(end.row.coord) - Number(row.coord) + 1
      );
      g.drawShape(rect);
    }

    // we only have one point, draw a single cell
    else if (col && row && !end) {
      const rect = sheet.getScreenRectangle(Number(col.coord), Number(row.coord), 1, 1);
      g.drawShape(rect);
    }
  });
  g.endFill();
};
// Draws a cursor with an infinite number of cells (this is drawn on each
// viewport update).
export const drawInfiniteCursor = (options: { g: Graphics; color: number; alpha: number; ranges: CellRefRange[] }) => {
  const { g, color, alpha, ranges } = options;
  const sheet = sheets.sheet;

  g.lineStyle();
  g.beginFill(color, alpha);
  const bounds = pixiApp.viewport.getVisibleBounds();

  ranges.forEach((range) => {
    const { col, row } = range.start;
    const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;

    // we've already drawn this range in the drawFiniteCursor function
    if (col && row && end?.col && end?.row) return;

    // the entire sheet is selected
    if (!col && !row && !end) {
      g.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    // one column is selected
    else if (col && !row && !end) {
      const { x, width } = sheet.getCellOffsets(col.coord, 0);
      if (intersects.rectangleRectangle({ x, y: bounds.y, width, height: bounds.height }, bounds)) {
        g.drawRect(x, bounds.y, width, bounds.height);
      }
    }

    // multiple columns are selected
    else if (col && !row && end && end.col && !end.row) {
      const rect = sheet.getScreenRectangle(Number(col.coord), 0, Number(end.col.coord) - 1, 0);
      rect.y = bounds.y;
      rect.height = bounds.height;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
      }
    }

    // multiple columns are selected starting on a row
    else if (col && !row && end && end.col && end.row) {
      const rect = sheet.getScreenRectangle(Number(col.coord), 0, Number(end.col.coord) - 1, Number(end.row.coord) - 1);
      rect.y = rect.bottom;
      rect.height = bounds.height - rect.y;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
      }
    }

    // multiple columns are selected starting on a row
    else if (col && row && end && end.col && !end.row) {
      const rect = sheet.getScreenRectangle(Number(col.coord), 0, Number(end.col.coord) - 1, Number(row.coord) - 1);
      rect.y = rect.bottom;
      rect.height = bounds.height - rect.y;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
      }
    }
  });

  g.endFill();
};
