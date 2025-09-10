//! Generic draw cursor functions that is used by both Cursor.ts and
//! UIMultiplayerCursor.ts.

import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import type { JsCoordinate, RefRangeBounds } from '@/app/quadratic-core-types';
import type { Graphics } from 'pixi.js';
import { Rectangle } from 'pixi.js';

const SECTION_OUTLINE_WIDTH = 1;
const SECTION_OUTLINE_NATIVE = true;

export const isStart = (coord: bigint): boolean => {
  // eslint-disable-next-line eqeqeq
  return coord == 1n;
};

export const isUnbounded = (coord: bigint): boolean => {
  // eslint-disable-next-line eqeqeq
  return coord == -1n;
};

export const drawCursorOutline = (g: Graphics, color: number, cursor: JsCoordinate) => {
  const outline = sheets.sheet.getCellOffsets(cursor.x, cursor.y);
  g.lineStyle({ width: CURSOR_THICKNESS, color, alignment: 0 });
  g.drawRect(outline.x, outline.y, outline.width, outline.height);
};

// Draws a cursor with a finite number of cells (this is drawn once for each
// selection setting).
export const drawFiniteSelection = (g: Graphics, color: number, alpha: number, ranges: RefRangeBounds[]) => {
  if (ranges.length === 0) return;

  g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 0, native: SECTION_OUTLINE_NATIVE });
  g.beginFill(color, alpha);

  const sheet = sheets.sheet;
  ranges.forEach((range) => {
    const start = range.start;
    const end = range.end;

    // we have all four points, just draw a rectangle
    if (!isUnbounded(end.col.coord) && !isUnbounded(end.row.coord)) {
      const startX = Math.min(Number(start.col.coord), Number(end.col.coord));
      const startY = Math.min(Number(start.row.coord), Number(end.row.coord));
      const width = Math.abs(Number(end.col.coord) - Number(start.col.coord)) + 1;
      const height = Math.abs(Number(end.row.coord) - Number(start.row.coord)) + 1;
      const rect = sheet.getScreenRectangle(startX, startY, width, height);
      g.drawShape(rect);
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
  ranges: RefRangeBounds[];
}): Rectangle | undefined => {
  const { g, color, alpha, ranges } = options;
  if (ranges.length === 0) return;

  const sheet = sheets.sheet;

  // we use headingSize to avoid getting column/row 0 from the viewport in
  // getScreenRectangle
  const headingSize = content.headings.headingSize;

  const bounds = pixiApp.viewport.getVisibleBounds();
  bounds.x = Math.max(bounds.x, 0);
  bounds.y = Math.max(bounds.y, 0);

  let rectangle: Rectangle | undefined;

  ranges.forEach((range) => {
    const start = range.start;
    const end = range.end;

    g.lineStyle();
    g.beginFill(color, alpha);
    // the entire sheet is selected
    if (
      isStart(start.col.coord) &&
      isStart(start.row.coord) &&
      isUnbounded(end.col.coord) &&
      isUnbounded(end.row.coord)
    ) {
      g.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
      g.endFill();
      g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
      g.moveTo(0, 0);
      g.lineTo(0, bounds.height);
      g.moveTo(0, 0);
      g.lineTo(bounds.width, 0);
    }

    // the entire sheet is selected starting from the start location
    else if (isUnbounded(end.col.coord) && isUnbounded(end.row.coord)) {
      const rect = sheet.getCellOffsets(start.col.coord, start.row.coord);
      rect.x = Math.max(rect.x, bounds.x);
      rect.y = Math.max(rect.y, bounds.y);
      rect.width = bounds.right - rect.x;
      rect.height = bounds.bottom - rect.y;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(rect.right, rect.top);
        g.lineTo(rect.left, rect.top);
        g.lineTo(rect.left, rect.bottom);
      }
    }

    // column(s) selected
    else if (isStart(start.row.coord) && isUnbounded(end.row.coord)) {
      const startX = Math.min(Number(start.col.coord), Number(end.col.coord));
      const width = Math.abs(Number(end.col.coord) - Number(start.col.coord)) + 1;
      const rect = sheet.getScreenRectangle(startX, headingSize.height, width, 0);
      rect.y = Math.max(0, bounds.y);
      rect.height = bounds.height;
      if (intersects.rectangleRectangle(rect, bounds)) {
        g.drawShape(rect);
        g.endFill();
        g.lineStyle({ width: SECTION_OUTLINE_WIDTH, color, alignment: 1, native: SECTION_OUTLINE_NATIVE });
        g.moveTo(rect.left, 0);
        g.lineTo(rect.right, 0);
        const top = Math.max(0, bounds.top);
        g.moveTo(rect.left, top);
        g.lineTo(rect.left, bounds.bottom);
        g.moveTo(rect.right, top);
        g.lineTo(rect.right, bounds.bottom);

        if (ranges.length === 1) {
          rectangle = new Rectangle(rect.left, top, rect.width, bounds.bottom - top);
        }
      }
    }

    // multiple columns are selected starting on a row
    else if (!isUnbounded(end.col.coord) && isUnbounded(end.row.coord)) {
      const startX = Math.min(Number(start.col.coord), Number(end.col.coord));
      const endX = Math.max(Number(start.col.coord), Number(end.col.coord));
      const rect = sheet.getScreenRectangle(
        startX,
        Number(start.row.coord),
        endX - startX + 1,
        Number(start.row.coord)
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

    // row(s) selected
    else if (isStart(start.col.coord) && isUnbounded(end.col.coord)) {
      const startY = Math.min(Number(start.row.coord), Number(end.row.coord));
      const height = Math.abs(Number(end.row.coord) - Number(start.row.coord)) + 1;
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

      if (ranges.length === 1) {
        rectangle = new Rectangle(bounds.x, rect.top, bounds.width, rect.height);
      }
    }

    // multiple rows are selected starting on a column
    else if (!isUnbounded(end.row.coord) && isUnbounded(end.col.coord)) {
      const startY = Math.min(Number(start.row.coord), Number(end.row.coord));
      const endY = Math.max(Number(start.row.coord), Number(end.row.coord));
      const rect = sheet.getScreenRectangle(
        Number(start.col.coord),
        startY,
        Number(start.col.coord),
        endY - startY + 1
      );
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
  });

  return rectangle;
};
