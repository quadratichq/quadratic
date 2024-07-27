import type { Graphics } from 'pixi.js';

import { sheets } from '@/app/grid/controller/Sheets';
import type { ColumnRowCursor, RectangleLike } from '@/app/grid/sheet/SheetCursor';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { Coordinate } from '@/app/gridGL/types/size';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';

const drawCursorOutline = (g: Graphics, color: number) => {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor.getCursor();
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

export const drawMultiCursor = (g: Graphics, color: number, alpha: number, rectangles: RectangleLike[]) => {
  const sheet = sheets.sheet;
  g.lineStyle(1, color, 1, 0, true);
  g.beginFill(color, alpha);
  rectangles.forEach((rectangle) => {
    const rect = sheet.getScreenRectangle(rectangle.x, rectangle.y, rectangle.width - 1, rectangle.height - 1);
    g.drawShape(rect);
  });
  g.endFill();
};
