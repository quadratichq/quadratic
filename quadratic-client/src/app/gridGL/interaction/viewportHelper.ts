import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { content } from '@/app/gridGL/pixiApp/Content';
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
  const top = viewport.top + content.headings.headingSize.height / pixiApp.viewport.scale.y;
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
  const left = viewport.left + content.headings.headingSize.width / pixiApp.viewport.scale.x;
  const placement = sheets.sheet.offsets.getXPlacement(left);

  // if the left column is partially visible, then return the next column
  if (placement.position >= left) {
    return placement.index;
  } else {
    return placement.index + 1;
  }
}

export function isRowVisible(row: number): boolean {
  const { viewport } = pixiApp;
  const { headings } = content;
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
  const { viewport } = pixiApp;
  const { headings } = content;
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
  const table = pixiApp.cellsSheet().tables.getTableIntersects(coordinate);
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
  const { viewport } = pixiApp;
  const { headings } = content;
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
  const newHeadingSize = content.headings.getFutureSizes(y);
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

  if (topLeftCell.left - headingWidth < x) {
    x = topLeftCell.left - headingWidth;
  }

  if (topLeftCell.top - headingHeight < y) {
    y = topLeftCell.top - headingHeight;
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
  pixiApp.viewportChanged();
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
  const { width, height } = content.headings.headingSize;
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
  const newRow = Math.max(1, sheet.getRowFromScreen(onePageY));

  // get the actual position of the new cursor in row coordinates
  const newCursorY = sheet.getRowY(newRow);

  // calculate the viewport location, clamping it ot the top of the viewport
  // (taking into account the headings)
  const gridHeadings = content.headings.headingSize.unscaledHeight;

  const halfScreenHeight = viewport.screenHeightInWorldPixels / 2;
  let centerY = Math.min(gridHeadings - halfScreenHeight, -newCursorY + distanceTopToCursor);

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
