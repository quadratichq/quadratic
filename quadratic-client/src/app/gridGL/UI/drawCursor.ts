//! Generic draw cursor functions that is used by both Cursor.ts and
//! UIMultiplayerCursor.ts.

import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { JsCoordinate } from '@/app/quadratic-core-types';
import { CellRefRange } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Graphics } from 'pixi.js';

const SECTION_OUTLINE_WIDTH = 1;
const SECTION_OUTLINE_NATIVE = true;

export const drawCursorOutline = (g: Graphics, color: number, cursor: JsCoordinate) => {
  const outline = sheets.sheet.getCellOffsets(cursor.x, cursor.y);
  g.lineStyle({ width: CURSOR_THICKNESS, color, alignment: 0 });
  g.drawRect(outline.x, outline.y, outline.width, outline.height);
};

// Draws a cursor with a finite number of cells (this is drawn once for each
// selection setting).
export const drawFiniteSelection = (g: Graphics, color: number, alpha: number, ranges: CellRefRange[]) => {
  g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 0, native: SECTION_OUTLINE_NATIVE });
  g.beginFill(color, alpha);

  const sheet = sheets.sheet;
  ranges.forEach((range) => {
    const { col, row } = range.start;
    const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;

    // we have all four points, just draw a rectangle
    if (col && row && end?.col && end?.row) {
      const startX = Math.min(Number(col.coord), Number(end.col.coord));
      const startY = Math.min(Number(row.coord), Number(end.row.coord));
      const width = Math.abs(Number(end.col.coord) - Number(col.coord)) + 1;
      const height = Math.abs(Number(end.row.coord) - Number(row.coord)) + 1;
      const rect = sheet.getScreenRectangle(startX, startY, width, height);
      g.drawShape(rect);
    } else if (col && row && !end) {
      if (ranges.length !== 1) {
        const rect = sheet.getScreenRectangle(Number(col.coord), Number(row.coord), 1, 1);
        g.drawShape(rect);
      }
    }
  });
  g.endFill();
};
// Draws a cursor with an infinite number of cells (this is drawn on each
// viewport update).
export const drawInfiniteSelection = (options: {
  g: Graphics;
  color: number;
  alpha: number;
  ranges: CellRefRange[];
}) => {
  const { g, color, alpha, ranges } = options;
  const sheet = sheets.sheet;

  // we use headingSize to avoid getting column/row 0 from the viewport in
  // getScreenRectangle
  const headingSize = pixiApp.headings.headingSize;

  const bounds = pixiApp.viewport.getVisibleBounds();
  bounds.x = Math.max(bounds.x, 0);
  bounds.y = Math.max(bounds.y, 0);

  ranges.forEach((range) => {
    const { col, row } = range.start;
    const end = range.end ? { col: range.end.col, row: range.end.row } : undefined;

    // we've already drawn this range in the drawFiniteCursor function
    if (col && row && end?.col && end?.row) return;

    g.lineStyle();
    g.beginFill(color, alpha);

    // the entire sheet is selected
    if (!col && !row && !end?.col && !end?.row) {
      g.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
      g.endFill();
      g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
      g.moveTo(0, 0);
      g.lineTo(0, bounds.height);
      g.moveTo(0, 0);
      g.lineTo(bounds.width, 0);
    }

    // one column is selected
    else if (col && !row && !end) {
      const { position, size } = sheet.offsets.getColumnPlacement(Number(col.coord));
      if (intersects.rectangleRectangle({ x: position, y: bounds.y, width: size, height: bounds.height }, bounds)) {
        g.drawRect(position, bounds.y, size, bounds.height);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(position, 0);
        g.lineTo(position + size, 0);
        g.moveTo(position, bounds.top);
        g.lineTo(position, bounds.bottom);
        g.moveTo(position + size, bounds.top);
        g.lineTo(position + size, bounds.bottom);
      }
    }

    // multiple columns are selected
    else if (col && !row && end && end.col && !end.row) {
      const startX = Math.min(Number(col.coord), Number(end.col.coord));
      const width = Math.abs(Number(end.col.coord) - Number(col.coord)) + 1;
      const rect = sheet.getScreenRectangle(startX, headingSize.height, width, 0);
      rect.y = Math.max(0, bounds.y);
      rect.height = bounds.height;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(rect.left, 0);
        g.lineTo(rect.right, 0);
        g.moveTo(rect.left, Math.max(0, bounds.top));
        g.lineTo(rect.left, bounds.bottom);
        g.moveTo(rect.right, Math.max(0, bounds.top));
        g.lineTo(rect.right, bounds.bottom);
      }
    }

    // multiple columns are selected starting on a row
    else if (col && row && end && end.col && !end.row) {
      const startX = Math.min(Number(col.coord), Number(end.col.coord));
      const endX = Math.max(Number(col.coord), Number(end.col.coord));
      const rect = sheet.getScreenRectangle(startX, Number(row.coord), endX - startX + 1, Number(row.coord));
      if (rect.y > bounds.bottom) return;

      rect.y = Math.max(rect.top, bounds.top);
      rect.height = bounds.bottom - rect.y;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(rect.left, rect.top);
        g.lineTo(rect.right, rect.top);
        g.moveTo(rect.left, rect.top);
        g.lineTo(rect.left, bounds.bottom);
        g.moveTo(rect.right, rect.top);
        g.lineTo(rect.right, bounds.bottom);
      }
    }

    // multiple columns are selected ending on a row
    else if (col && !row && end && end.col && end.row) {
      const startX = Math.min(Number(col.coord), Number(end.col.coord));
      const endX = Math.max(Number(col.coord), Number(end.col.coord));
      const rect = sheet.getScreenRectangle(
        startX,
        Number(end.row.coord),
        endX - startX + 1,
        Number(end.row.coord) - headingSize.height
      );
      if (rect.y > bounds.bottom) return;

      rect.y = Math.max(rect.top, bounds.top);
      rect.height = bounds.bottom - rect.y;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(rect.left, rect.top);
        g.lineTo(rect.right, rect.top);
        g.moveTo(rect.left, rect.top);
        g.lineTo(rect.left, bounds.bottom);
        g.moveTo(rect.right, rect.top);
        g.lineTo(rect.right, bounds.bottom);
      }
    }

    // one row is selected
    else if (!col && row && !end) {
      const { position, size } = sheet.offsets.getRowPlacement(Number(row.coord));
      if (intersects.rectangleRectangle({ x: bounds.x, y: position, width: bounds.width, height: size }, bounds)) {
        g.drawRect(bounds.x, position, bounds.width, size);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(0, position);
        g.lineTo(0, position + size);
        g.moveTo(bounds.left, position);
        g.lineTo(bounds.right, position);
        g.moveTo(bounds.left, position + size);
        g.lineTo(bounds.right, position + size);
      }
    }

    // multiple rows are selected
    else if (!col && row && end && end.row && !end.col) {
      const startY = Math.min(Number(row.coord), Number(end.row.coord));
      const height = Math.abs(Number(end.row.coord) - Number(row.coord)) + 1;
      const rect = sheet.getScreenRectangle(headingSize.width, startY, 0, height);
      rect.x = Math.max(0, bounds.x);
      rect.width = bounds.width;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(0, rect.top);
        g.lineTo(0, rect.bottom);
        g.moveTo(bounds.left, rect.top);
        g.lineTo(bounds.right, rect.top);
        g.moveTo(bounds.left, rect.bottom);
        g.lineTo(bounds.right, rect.bottom);
      }
    }

    // multiple rows are selected starting on a column
    else if (row && col && end && end.row && !end.col) {
      const startY = Math.min(Number(row.coord), Number(end.row.coord));
      const endY = Math.max(Number(row.coord), Number(end.row.coord));
      const rect = sheet.getScreenRectangle(Number(col.coord), startY, Number(col.coord), endY - startY + 1);
      if (rect.x > bounds.right) return;

      rect.x = Math.max(rect.left, bounds.x);
      rect.width = bounds.right - rect.x;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(rect.left, rect.top);
        g.lineTo(rect.left, rect.bottom);
        g.moveTo(rect.left, rect.top);
        g.lineTo(bounds.right, rect.top);
        g.moveTo(rect.left, rect.bottom);
        g.lineTo(rect.right, rect.bottom);
      }
    }

    // multiple rows are selected ending on a column
    else if (row && !col && end && end.row && end.col) {
      const startY = Math.min(Number(row.coord), Number(end.row.coord));
      const endY = Math.max(Number(row.coord), Number(end.row.coord));
      const rect = sheet.getScreenRectangle(Number(end.col.coord), startY, Number(end.col.coord), endY - startY + 1);
      rect.x = Math.max(rect.left, bounds.x);
      rect.width = bounds.right - rect.x;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(rect.left, rect.top);
        g.lineTo(rect.left, rect.bottom);
        g.moveTo(rect.left, rect.top);
        g.lineTo(rect.right, rect.top);
        g.moveTo(rect.left, rect.bottom);
        g.lineTo(rect.right, rect.bottom);
      }
    }
  });
};
