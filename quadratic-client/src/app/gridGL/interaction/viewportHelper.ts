/* eslint-disable @typescript-eslint/no-unused-vars */
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { Point } from 'pixi.js';

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
  let y = viewport.y;
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

  if (left !== undefined || right !== undefined || top !== undefined || bottom !== undefined) {
    const halfWidth = viewport.worldScreenWidth / 2;
    const halfHeight = viewport.worldScreenHeight / 2;
    const x = left !== undefined ? left + halfWidth : right !== undefined ? right - halfWidth : viewport.center.x;
    const y = top !== undefined ? top + halfHeight : bottom !== undefined ? bottom - halfHeight : viewport.center.y;
    return { x, y };
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
export function rectVisible(sheetId: string, min: JsCoordinate, max?: JsCoordinate): boolean {
  if (sheetId !== sheets.current) {
    sheets.current = sheetId;
  }
  const move = calculateRectVisible(min, max);
  if (move) {
    animateViewport(move);
    return false;
  } else {
    return true;
  }
}

export function ensureRectVisible(sheetId: string, min: JsCoordinate, max?: JsCoordinate) {
  if (!rectVisible(sheetId, min, max)) {
    pixiApp.viewportChanged();
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
  rectVisible(sheets.current, sheets.sheet.cursor.position);
  pixiApp.viewportChanged();
  return false;
}

// Ensures the cursor is always visible
export function ensureVisible(visible: JsCoordinate | undefined) {
  if (visible) {
    if (!rectVisible(sheets.current, visible)) {
      pixiApp.viewportChanged();
    }
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
  const cursorY = sheet.getRowY(cursorPosition.y);

  // distance from cursor to center of viewport
  let distanceTopToCursor = cursorY - viewport.center.y;

  // if distance between cursor and top of viewport is greater than the screen
  // height, then center the cursor
  if (Math.abs(distanceTopToCursor) > viewport.screenHeightInWorldPixels) {
    distanceTopToCursor = 0;
  }

  // calculate where the new cursor will be after the page up/down
  const onePageY = cursorY + viewport.screenHeightInWorldPixels * (up ? -1 : 1);

  // clamp to the first row
  const newRow = Math.max(1, sheet.getColumnRowFromScreen(0, onePageY).row);

  // get the actual position of the new cursor in row coordinates
  const newCursorY = sheet.getRowY(newRow);

  // calculate the viewport location, clamping it ot the top of the viewport
  // (taking into account the headings)
  const gridHeadings = pixiApp.headings.headingSize.unscaledHeight;
  const y = Math.min(gridHeadings - viewport.screenHeightInWorldPixels / 2, -newCursorY + distanceTopToCursor);
  return { x: viewport.center.x, y, column: cursorPosition.x, row: newRow };
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
  animateViewport({ x, y: -y });
}
