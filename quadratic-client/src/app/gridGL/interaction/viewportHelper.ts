import { HEADING_SIZE } from '@/shared/constants/gridConstants';
import { Point } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { intersects } from '../helpers/intersects';
import { pixiApp } from '../pixiApp/PixiApp';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { Coordinate } from '../types/size';

export function isVisible() {
  // returns true if the cursor is visible in the viewport
  const { viewport, headings } = pixiApp;
  const sheet = sheets.sheet;
  const { cursor } = sheet;
  const headingSize = headings.headingSize;

  const column = cursor.keyboardMovePosition.x;
  const row = cursor.keyboardMovePosition.y;
  const cell = sheet.getCellOffsets(column, row);
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
export function ensureVisible(): void {
  if (!isVisible()) {
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
export function moveViewport(options: {
  center?: Coordinate;
  topLeft?: Coordinate;
  pageUp?: boolean;
  pageDown?: boolean;
  force?: boolean;
}): void {
  const { center, topLeft, pageUp, pageDown, force } = options;
  if (!center && !topLeft && !pageUp && !pageDown) return;

  const sheet = sheets.sheet;
  const bounds = pixiApp.viewport.getVisibleBounds();
  const adjust = pixiAppSettings.showHeadings ? HEADING_SIZE : 0;

  if (center) {
    const cell = sheet.getCellOffsets(center.x, center.y);
    if (!force && intersects.rectanglePoint(bounds, new Point(cell.x, cell.y))) return;
    pixiApp.viewport.moveCenter(cell.x + cell.width / 2, cell.y + cell.height / 2);
  } else if (topLeft) {
    const cell = sheet.getCellOffsets(topLeft.x, topLeft.y);
    if (!force && intersects.rectanglePoint(bounds, new Point(cell.x - adjust, cell.y - adjust))) return;
    pixiApp.viewport.moveCorner(cell.x - adjust, cell.y - adjust);
  } else if (pageUp) {
    pixiApp.viewport.moveCorner(bounds.x, bounds.y - (bounds.height - adjust));
  } else if (pageDown) {
    pixiApp.viewport.moveCorner(bounds.x, bounds.y + (bounds.height - adjust));
  }

  pixiApp.viewportChanged();
}

export function getShareUrlParams(): string {
  let url = `x=${sheets.sheet.cursor.cursorPosition.x}&y=${sheets.sheet.cursor.cursorPosition.y}`;
  if (sheets.sheet !== sheets.getFirst()) {
    url += `&sheet=${sheets.sheet.name}`;
  }
  const state = pixiAppSettings.editorInteractionState;
  if (state.showCodeEditor) {
    url += `&codeLanguage=${state.mode}&codeX=${state.selectedCell.x}&codeY=${state.selectedCell.y}`;
    if (state.selectedCellSheet !== sheets.sheet.id) {
      url += `&codeSheet=${sheets.sheet.name}`;
    }
  }
  return url;
}
