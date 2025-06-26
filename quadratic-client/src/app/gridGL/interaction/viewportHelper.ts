/* eslint-disable @typescript-eslint/no-unused-vars */
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { Point, Rectangle } from 'pixi.js';

// animating viewport
const ANIMATION_TIME = 150;
const ANIMATION_TIME_SHORT = 50;

// distance where we use the short animation time
const ANIMATION_SHORT_DISTANCE_SQUARED = 600 ** 2;

const ANIMATION_EASE = 'easeInOutSine';

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

// Gets the viewport Y to ensure that the cell is not under the table header
function getYToEnsureCursorIsNotUnderTableHeader(
  coordinate: JsCoordinate,
  bounds: Rectangle,
  cell: Rectangle
): number | undefined {
  const table = pixiApp.cellsSheet().tables.getInTable(coordinate);
  if (!table) return;
  const code = table.codeCell;
  if (code.state === 'SpillError' || code.state === 'RunError' || code.is_html_image) {
    return;
  }

  // if the cell rectangle intersects with the table header, return the viewport Y position
  // needed to position the cell below the table header
  const tableHeaderBounds = table.calculateHeadingBounds(bounds);
  if (tableHeaderBounds && intersects.rectangleRectangle(tableHeaderBounds, cell)) {
    return bounds.top - tableHeaderBounds.bottom + cell.top;
  }
  return;
}

export function calculateRectVisible(min: JsCoordinate, max?: JsCoordinate): JsCoordinate | undefined {
  // returns true if the rect is visible in the viewport
  const { viewport, headings } = pixiApp;
  const sheet = sheets.sheet;

  const topLeftCell = sheet.getCellOffsets(min.x, min.y);
  const same = !max || (min.x === max.x && min.y === max.y);
  const bottomRightCell = same ? topLeftCell : sheet.getCellOffsets(max.x, max.y);

  const headingHeight = headings.headingSize.unscaledHeight;

  let right: number | undefined;
  let left: number | undefined;
  let bottom: number | undefined;
  let top: number | undefined;

  const scale = 1 / pixiApp.viewport.scale.x;

  // y is used to calculate the future size of the headings
  let y = -viewport.y * scale;

  if (bottomRightCell.bottom > viewport.bottom) {
    bottom = bottomRightCell.bottom;
    y = bottom - viewport.worldScreenHeight;
  }
  if (topLeftCell.top - headingHeight < viewport.top) {
    top = topLeftCell.top - headingHeight;
    y = top;
  }

  // calculate the new rowWidth when at new Y location
  const newHeadingSize = pixiApp.headings.getFutureSizes(y);
  const headingWidth = newHeadingSize.unscaledWidth;

  if (bottomRightCell.right > viewport.right) {
    right = bottomRightCell.right;
  }
  if (topLeftCell.left - headingWidth < viewport.left) {
    left = topLeftCell.left - headingWidth;
  }

  let x = -viewport.x * scale;
  if (left !== undefined || right !== undefined || top !== undefined || bottom !== undefined) {
    x = left !== undefined ? left : right !== undefined ? right - viewport.worldScreenWidth : -viewport.x * scale;
    y = top !== undefined ? top : bottom !== undefined ? bottom - viewport.worldScreenHeight : -viewport.y * scale;
  }

  const futureVisibleBounds = new Rectangle(x, y, viewport.worldScreenWidth, viewport.worldScreenHeight);
  y = getYToEnsureCursorIsNotUnderTableHeader(min, futureVisibleBounds, topLeftCell) ?? y;

  if (x !== -viewport.x || y !== -viewport.y) {
    return { x: x + viewport.worldScreenWidth / 2, y: y + viewport.worldScreenHeight / 2 };
  }
}

// Animates the viewport to a new screen location
export function animateViewport(move: JsCoordinate) {
  const distanceSquared = (move.x - pixiApp.viewport.center.x) ** 2 + (move.y - pixiApp.viewport.center.y) ** 2;
  const time = distanceSquared < ANIMATION_SHORT_DISTANCE_SQUARED ? ANIMATION_TIME_SHORT : ANIMATION_TIME;
  pixiApp.viewport.animate({
    position: new Point(move.x, move.y),
    removeOnInterrupt: true,
    time,
    ease: ANIMATION_EASE,
  });
}

// Makes a rect visible in the viewport. Returns true if the rect is visible in the viewport.
export function ensureRectVisible(sheetId: string, min: JsCoordinate, max?: JsCoordinate) {
  if (sheetId !== sheets.current) {
    sheets.current = sheetId;
  }
  const move = calculateRectVisible(min, max);
  if (move) {
    animateViewport(move);
  }
}

export function ensureSelectionVisible() {
  // use cell coordinates b/c selection may include unbounded ranges that we
  // don't want to translate to world coordinates
  const selection = sheets.sheet.cursor.getLargestRectangleUnbounded();
  const viewportBounds = pixiApp.viewport.getVisibleBounds();
  const viewportBoundsInCellCoordinates = sheets.sheet.getRectangleFromScreen(viewportBounds);

  // if any part of the selection is visible
  if (intersects.rectangleRectangle(selection, viewportBoundsInCellCoordinates)) {
    return true;
  }
  ensureRectVisible(sheets.current, sheets.sheet.cursor.position);
  return false;
}

// Ensures the cursor is always visible
export function ensureVisible(visible: JsCoordinate | undefined) {
  if (visible) {
    ensureRectVisible(sheets.current, visible);
  } else {
    ensureSelectionVisible();
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
export function moveViewport(options: { center?: JsCoordinate; topLeft?: JsCoordinate; force?: boolean }): void {
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

// Calculates the new row and y position for a page up and down
export function calculatePageUpDown(
  up: boolean,
  select: boolean
): { x: number; y: number; column: number; row: number } {
  const { viewport } = pixiApp;
  const { sheet } = sheets;

  // use end of selection if we are selecting
  const cursorPosition = select ? sheet.cursor.selectionEnd : sheet.cursor.position;

  // current position of the cursor in world coordinates
  const cursorRect = sheet.getCellOffsets(cursorPosition.x, cursorPosition.y);

  // distance from cursor to center of viewport
  let distanceTopToCursor = cursorRect.y - viewport.center.y;

  // if distance between cursor and top of viewport is greater than the screen
  // height, then center the cursor
  if (Math.abs(distanceTopToCursor) > viewport.screenHeightInWorldPixels) {
    distanceTopToCursor = 0;
  }

  // calculate where the new cursor will be after the page up/down
  const onePageY = cursorRect.y + viewport.screenHeightInWorldPixels * (up ? -1 : 1);

  // clamp to the first row
  const newRow = Math.max(1, sheet.getColumnRowFromScreen(0, onePageY).row);

  // get the actual position of the new cursor in row coordinates
  const newCursorY = sheet.getRowY(newRow);

  // calculate the viewport location, clamping it ot the top of the viewport
  // (taking into account the headings)
  const gridHeadings = pixiApp.headings.headingSize.unscaledHeight;

  const halfScreenHeight = viewport.screenHeightInWorldPixels / 2;
  let centerY = Math.min(gridHeadings - halfScreenHeight, -newCursorY + distanceTopToCursor);

  // const visibleBounds = viewport.getVisibleBounds();
  // const adjustedY = getYToEnsureCursorIsNotUnderTableHeader(
  //   cursorPosition,
  //   new Rectangle(visibleBounds.left, centerY - halfScreenHeight, visibleBounds.width, visibleBounds.height),
  //   cursorRect
  // );

  // if (adjustedY !== undefined) {
  //   centerY = adjustedY;
  // }

  return { x: -viewport.center.x, y: centerY, column: cursorPosition.x, row: newRow };
}

// Returns whether the viewport is currently animating to a location
export function isAnimating(): boolean {
  return !!pixiApp.viewport.plugins.get('animate');
}

// Moves the cursor up or down one page
export function pageUpDown(up: boolean) {
  if (isAnimating()) return;
  const { x, y, column, row } = calculatePageUpDown(up, false);
  const cursor = sheets.sheet.cursor;
  cursor.moveTo(column, row, { checkForTableRef: true, ensureVisible: false });
  animateViewport({ x: -x, y: -y });
}

/*

// Makes a rect visible in the viewport
export function rectVisible(sheetId: string, min: JsCoordinate, max: JsCoordinate): boolean {
  if (sheetId !== sheets.current) {
    sheets.current = sheetId;
  }
  // returns true if the rect is visible in the viewport
  const { viewport, headings } = pixiApp;
  const sheet = sheets.sheet;
  const headingSize = headings.headingSize;

  const topLeftCell = sheet.getCellOffsets(min.x, min.y);
  const bottomRightCell = sheet.getCellOffsets(max.x, max.y);
  let is_off_screen = false;

  if (bottomRightCell.right > viewport.right) {
    viewport.right = bottomRightCell.right;
    is_off_screen = true;
  }
  if (topLeftCell.left + headingSize.width < viewport.left) {
    viewport.left = topLeftCell.left - headingSize.width / viewport.scale.x;
    is_off_screen = true;
  }

  if (bottomRightCell.bottom > viewport.bottom) {
    viewport.bottom = bottomRightCell.bottom;
    is_off_screen = true;
  }
  if (topLeftCell.top + headingSize.height < viewport.top) {
    viewport.top = topLeftCell.top - headingSize.height / viewport.scale.x;
    is_off_screen = true;
  }

  return !is_off_screen;
}

export function ensureRectVisible(sheetId: string, min: JsCoordinate, max: JsCoordinate) {
  if (!rectVisible(sheetId, min, max)) {
    pixiApp.viewportChanged();
  }
}

function ensureCellIsNotUnderTableHeader(coordinate: JsCoordinate, cell: Rectangle): boolean {
  const table = pixiApp.cellsSheet().tables.getInTable(coordinate);
  if (!table) return false;
  const code = table.codeCell;
  if (code.state === 'SpillError' || code.state === 'RunError' || code.is_html_image) {
    return false;
  }
  if (table.header.onGrid) return false;

  // we need to manually update the table to ensure it is in the correct position
  // this usually happens during the update loop, but that's too late for our needs
  const bounds = pixiApp.viewport.getVisibleBounds();
  const gridHeading = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
  table.update(bounds, gridHeading);

  const tableHeaderBounds = table.header.getTableHeaderBounds();
  if (intersects.rectangleRectangle(tableHeaderBounds, cell)) {
    pixiApp.viewport.top -= tableHeaderBounds.bottom - cell.top;
    return true;
  }
  return false;
}

export function ensureSelectionVisible() {
  // use cell coordinates b/c selection may include unbounded ranges that we
  // don't want to translate to world coordinates
  const selection = sheets.sheet.cursor.getLargestRectangleUnbounded();
  const viewportBounds = pixiApp.viewport.getVisibleBounds();
  const viewportBoundsInCellCoordinates = sheets.sheet.getRectangleFromScreen(viewportBounds);

  // if any part of the selection is visible
  if (intersects.rectangleRectangle(selection, viewportBoundsInCellCoordinates)) {
    return true;
  }
  cellVisible(sheets.sheet.cursor.position);
  pixiApp.viewportChanged();
  return false;
}

// Makes a cell visible in the viewport
export function cellVisible(
  coordinate: JsCoordinate = {
    x: sheets.sheet.cursor.position.x,
    y: sheets.sheet.cursor.position.y,
  }
): boolean {
  // returns true if the cursor is visible in the viewport
  const { viewport, headings } = pixiApp;
  const sheet = sheets.sheet;
  const headingSize = headings.headingSize;

  // check if the cell is part of a table header that is visible b/c it is
  // hovering over the table
  const tableName = sheet.cursor.getTableNameInNameOrColumn(sheets.sheet.id, coordinate.x, coordinate.y);
  if (tableName) return true;

  const cell = sheet.getCellOffsets(coordinate.x, coordinate.y);
  let is_off_screen = false;

  const bounds = pixiApp.viewport.getVisibleBounds();
  if (cell.x - headingSize.width / viewport.scale.x < viewport.left) {
    viewport.left = Math.max(
      -headingSize.width / viewport.scale.x,
      cell.x - headingSize.width / viewport.scale.x //+ BUFFER[0]
    );
    is_off_screen = true;
  } else if (cell.x + cell.width > viewport.right) {
    // if the cell is wider than the viewport, then we show the start of the cell
    if (cell.width > bounds.width) {
      viewport.left = Math.max(
        -headingSize.width / viewport.scale.x,
        cell.x - headingSize.width / viewport.scale.x //+ BUFFER[0]
      );
    } else {
      viewport.right = cell.x + cell.width + BUFFER[0];
    }
    is_off_screen = true;
  }

  if (cell.y < viewport.top + headingSize.height / viewport.scale.y) {
    viewport.top = Math.max(
      -headingSize.height / viewport.scale.y,
      cell.y - headingSize.height / viewport.scale.y - BUFFER[1]
    );
    is_off_screen = true;
  } else if (cell.y + cell.height > viewport.bottom) {
    // if the cell is taller than the viewport, then we show the start of the cell
    if (cell.height > bounds.height) {
      viewport.top = Math.max(
        -headingSize.height / viewport.scale.y,
        cell.y - headingSize.height / viewport.scale.y - BUFFER[1]
      );
    } else {
      viewport.bottom = cell.y + cell.height + BUFFER[1];
    }
    is_off_screen = true;
  }

  if (ensureCellIsNotUnderTableHeader(coordinate, cell)) {
    is_off_screen = true;
  }

  return !is_off_screen;
}

// Ensures the cursor is always visible
export function ensureVisible(visible: JsCoordinate | undefined) {
  if (visible) {
    if (!cellVisible(visible)) {
      pixiApp.viewportChanged();
    }
  } else {
    ensureSelectionVisible();
  }
}

export function moveViewport(options: { center?: JsCoordinate; topLeft?: JsCoordinate; force?: boolean }): void {
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
    cursor.moveTo(cursor.position.x, newRow, { checkForTableRef: true, ensureVisible: false });
    const newCursorY = sheets.sheet.getRowY(newRow);
    const gridHeadings = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
    pixiApp.viewport.y = Math.min(gridHeadings, -newCursorY + distanceTopToCursorTop);
    pixiApp.viewportChanged();
  }
}

*/
