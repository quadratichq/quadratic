import { Point } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { intersects } from '../helpers/intersects';
import { pixiApp } from '../pixiApp/PixiApp';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { Coordinate } from '../types/size';

export function getVisibleTopRow(): number {
  const viewport = pixiApp.viewport.getVisibleBounds();
  const top = viewport.top + pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
  const placement = sheets.sheet.offsets.getYPlacement(top);

  // if the top row is partially visible, then return the next row
  if (placement.position >= top) {
    return placement.index;
  } else {
    return placement.index + 1;
  }
}

export function getVisibleLeftColumn(): number {
  const viewport = pixiApp.viewport.getVisibleBounds();
  const left = viewport.left + pixiApp.headings.headingSize.width / pixiApp.viewport.scale.x;
  const placement = sheets.sheet.offsets.getXPlacement(left);

  // if the left column is partially visible, then return the next column
  if (placement.position >= left) {
    return placement.index;
  } else {
    return placement.index + 1;
  }
}

export function isRowVisible(row: number): boolean {
  const { viewport, headings } = pixiApp;
  const sheet = sheets.sheet;
  const headingSize = headings.headingSize;

  const offset = sheet.offsets.getRowPlacement(row);

  if (offset.position < viewport.top + headingSize.height / viewport.scale.y) {
    return false;
  } else if (offset.position + offset.size > viewport.bottom) {
    return false;
  }
  return true;
}

export function isColumnVisible(column: number): boolean {
  const { viewport, headings } = pixiApp;
  const sheet = sheets.sheet;
  const headingSize = headings.headingSize;

  const offset = sheet.offsets.getColumnPlacement(column);

  if (offset.position + headingSize.width < viewport.left) {
    return false;
  } else if (offset.position > viewport.right) {
    return false;
  }
  return true;
}

// Makes a cell visible in the viewport
export function cellVisible(
  coordinate: Coordinate = {
    x: sheets.sheet.cursor.position.x,
    y: sheets.sheet.cursor.position.y,
  }
): boolean {
  // returns true if the cursor is visible in the viewport
  const { viewport, headings } = pixiApp;
  const sheet = sheets.sheet;
  const headingSize = headings.headingSize;

  const cell = sheet.getCellOffsets(coordinate.x, coordinate.y);
  let is_off_screen = false;

  if (cell.x + headingSize.width < viewport.left) {
    viewport.left = cell.x - headingSize.width / viewport.scale.x;
    is_off_screen = true;
  } else if (cell.x + cell.width > viewport.right) {
    viewport.right = cell.x + cell.width;
    is_off_screen = true;
  }

  if (cell.y < viewport.top + headingSize.height / viewport.scale.y) {
    viewport.top = cell.y - headingSize.height / viewport.scale.y;
    is_off_screen = true;
  } else if (cell.y + cell.height > viewport.bottom) {
    viewport.bottom = cell.y + cell.height;
    is_off_screen = true;
  }

  return !is_off_screen;
}

// Ensures the cursor is always visible
export function ensureVisible(visible: Coordinate | undefined) {
  if (!cellVisible(visible)) {
    pixiApp.viewportChanged();
  }
}

/**
 * Moves viewport to either a center or top-left cell location
 * @param options
 * @param [options.app]
 * @param [options.center] cell coordinate to center viewport
 * @param [options.topLeft] cell coordinate to place at topLeft of viewport (adjusting for ruler if needed)
 * @param [options.pageUp] move viewport up one page
 * @param [options.pageDown] move viewport down one page
 * @param [options.force] force viewport to move even if cell is already visible
 */
export function moveViewport(options: { center?: Coordinate; topLeft?: Coordinate; force?: boolean }): void {
  const { center, topLeft, force } = options;
  if (!center && !topLeft) return;

  const sheet = sheets.sheet;
  const bounds = pixiApp.viewport.getVisibleBounds();
  const zoom = pixiApp.viewport.scale.x;
  const { width, height } = pixiApp.headings.headingSize;
  const adjustX = width / zoom;
  const adjustY = height / zoom;

  if (center) {
    const cell = sheet.getCellOffsets(center.x, center.y);
    if (!force && intersects.rectanglePoint(bounds, new Point(cell.x, cell.y))) return;
    pixiApp.viewport.moveCenter(cell.x + cell.width / 2, cell.y + cell.height / 2);
  } else if (topLeft) {
    const cell = sheet.getCellOffsets(topLeft.x, topLeft.y);
    if (!force && intersects.rectanglePoint(bounds, new Point(cell.x - adjustX, cell.y - adjustY))) return;
    pixiApp.viewport.moveCorner(cell.x - adjustX, cell.y - adjustY);
  }

  pixiApp.viewportChanged();
}

export function getShareUrlParams(): string {
  let url = `x=${sheets.sheet.cursor.position.x}&y=${sheets.sheet.cursor.position.y}`;
  if (sheets.sheet !== sheets.getFirst()) {
    url += `&sheet=${sheets.sheet.name}`;
  }
  const { showCodeEditor, codeCell } = pixiAppSettings.codeEditorState;
  if (showCodeEditor) {
    url += `&codeLanguage=${codeCell.language}&codeX=${codeCell.pos.x}&codeY=${codeCell.pos.y}`;
    if (codeCell.sheetId !== sheets.current) {
      url += `&codeSheet=${sheets.sheet.name}`;
    }
  }
  return url;
}

// Moves the cursor up or down one page
export function pageUpDown(up: boolean) {
  const cursorRect = pixiApp.cursor.cursorRectangle;
  const { viewport } = pixiApp;
  if (cursorRect) {
    const distanceTopToCursorTop = cursorRect.top - viewport.top;
    const newY = cursorRect.y + pixiApp.viewport.screenHeightInWorldPixels * (up ? -1 : 1);
    const newRow = Math.max(1, sheets.sheet.getColumnRowFromScreen(0, newY).row);
    const cursor = sheets.sheet.cursor;
    cursor.changePosition({
      columnRow: null,
      multiCursor: null,
      cursorPosition: { x: cursor.position.x, y: newRow },
      keyboardMovePosition: { x: cursor.position.x, y: newRow },
      ensureVisible: false,
    });
    const newCursorY = sheets.sheet.getRowY(newRow);
    const gridHeadings = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
    pixiApp.viewport.y = Math.min(gridHeadings, -newCursorY + distanceTopToCursorTop);
    pixiApp.viewportChanged();
  }
}
