import { Graphics } from 'pixi.js';
import { Coordinate } from '../types/size';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '../pixiApp/PixiApp';
import { intersects } from '../helpers/intersects';
import { ColumnRowCursor, RectangleLike } from '@/app/grid/sheet/SheetCursor';

const drawCursorOutline = (g: Graphics, color: number) => {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor.getCursor();
  const outline = sheet.getCellOffsets(cursor.x, cursor.y);
  g.lineStyle(1, color, 1, 0, true);
  g.drawRect(outline.x, outline.y, outline.width, outline.height);
};

// Draws a cursor hole for use in multiCursor and columnRowCursor
export const drawCursorHole = (g: Graphics, cursorPosition: Coordinate) => {
  const sheet = sheets.sheet;
  const visible = pixiApp.viewport.getVisibleBounds();
  const hole = sheet.getCellOffsets(cursorPosition.x, cursorPosition.y);

  // need to ensure the hole is contained by the screen rect, otherwise we get
  // weird visual artifacts.
  if (!intersects.rectangleRectangle(hole, visible)) return;
  g.beginHole();
  const x1 = hole.x < visible.left ? visible.left : hole.left;
  const x2 = hole.right > visible.right ? visible.right : hole.right;
  const y1 = hole.y < visible.top ? visible.top : hole.top;
  const y2 = hole.bottom > visible.bottom ? visible.bottom : hole.bottom;
  g.drawRect(x1, y1, x2 - x1, y2 - y1);
  g.endHole();
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
    drawCursorHole(g, cursorPosition);
  } else if (columnRow.columns) {
    let minX = Infinity,
      maxX = -Infinity;
    columnRow.columns.forEach((column) => {
      const { x, width } = sheet.getCellOffsets(column, 0);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width);
      g.drawRect(x, bounds.y, width, bounds.height);
      if (column === cursorPosition.x) {
        drawCursorHole(g, cursorPosition);
      }
    });

    // draw outline
    g.lineStyle(1, color, 1, 0, true);
    g.moveTo(minX, bounds.top);
    g.lineTo(minX, bounds.bottom);
    g.moveTo(maxX, bounds.top);
    g.lineTo(maxX, bounds.bottom);
  } else if (columnRow.rows) {
    let minY = Infinity,
      maxY = -Infinity;
    columnRow.rows.forEach((row) => {
      const { y, height } = sheet.getCellOffsets(0, row);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height);
      g.drawRect(bounds.x, y, bounds.width, height);
      if (row === cursorPosition.y) {
        drawCursorHole(g, cursorPosition);
      }
    });

    // draw outline
    g.lineStyle(1, color, 1, 0, true);
    g.moveTo(bounds.left, minY);
    g.lineTo(bounds.right, minY);
    g.moveTo(bounds.left, maxY);
    g.lineTo(bounds.right, maxY);
  }
  g.endFill();
  drawCursorOutline(g, color);
};

export const drawMultiCursor = (g: Graphics, color: number, alpha: number, rectangles: RectangleLike[]) => {
  const sheet = sheets.sheet;
  g.lineStyle(1, color, 1, 0, true);
  g.beginFill(color, alpha);
  rectangles.forEach((rectangle, index) => {
    const rect = sheet.getScreenRectangle(rectangle.x, rectangle.y, rectangle.width - 1, rectangle.height - 1);
    g.drawShape(rect);
  });
  g.endFill();
};
