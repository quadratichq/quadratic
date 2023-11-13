import { HEADING_SIZE } from '../../constants/gridConstants';
import { sheets } from '../../grid/controller/Sheets';
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
 */
export function moveViewport(options: { center?: Coordinate; topLeft?: Coordinate }): void {
  const { center, topLeft } = options;
  if (!center && !topLeft) return;
  const sheet = sheets.sheet;

  if (center) {
    const cell = sheet.getCellOffsets(center.x, center.y);
    pixiApp.viewport.moveCenter(cell.x + cell.width / 2, cell.y + cell.height / 2);
  }

  if (topLeft) {
    const adjust = pixiAppSettings.showHeadings ? HEADING_SIZE : 0;
    const cell = sheet.getCellOffsets(topLeft.x + adjust, topLeft.y + adjust);
    pixiApp.viewport.moveCorner(cell.x, cell.y);
  }

  pixiApp.viewportChanged();
}
