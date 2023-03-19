import { Point, Rectangle } from 'pixi.js';
import { GridInteractionState } from '../../atoms/gridInteractionStateAtom';
import { HEADING_SIZE } from '../../constants/gridConstants';
import { Sheet } from '../../grid/sheet/Sheet';
import { PixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';

export function isVisible(options: { app: PixiApp; interactionState: GridInteractionState; sheet: Sheet }) {
  // returns true if the cursor is visible in the viewport
  const { interactionState, app, sheet } = options;
  const { viewport, headings } = app;
  const { gridOffsets } = sheet;
  const headingSize = headings.headingSize;

  const column = interactionState.keyboardMovePosition.x;
  const row = interactionState.keyboardMovePosition.y;
  const cell = gridOffsets.getCell(column, row);
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
export function ensureVisible(options: { app: PixiApp; interactionState: GridInteractionState; sheet: Sheet }): void {
  const { interactionState, app, sheet } = options;

  if (!isVisible({ app, interactionState, sheet })) {
    app.viewportChanged();
  }
}

/**
 * Moves viewport to either a center or top-left cell location
 * @param options
 * @param [options.app]
 * @param [options.center] cell coordinate to center viewport
 * @param [options.topLeft] cell coordinate to place at topLeft of viewport (adjusting for ruler if needed)
 */
export function moveViewport(options: { app: PixiApp; center?: Coordinate; topLeft?: Coordinate }): void {
  const { app, center, topLeft } = options;
  if (!center && !topLeft) return;

  if (center) {
    const cell = app.sheet.gridOffsets.getCell(center.x, center.y);
    app.viewport.moveCenter(cell.x + cell.width / 2, cell.y + cell.height / 2);
  }

  if (topLeft) {
    const adjust = app.settings.showHeadings ? HEADING_SIZE : 0;
    const cell = app.sheet.gridOffsets.getCell(topLeft.x + adjust, topLeft.y + adjust);
    app.viewport.moveCorner(cell.x, cell.y);
  }

  app.viewportChanged();
}

/**
 * converts a DOMRect to a PIXI.Rectangle in world coordinates
 * @param app
 * @domRectangle
 * @returns
 */
export function domRectangleToViewportScreenRectangle(app: PixiApp, domRectangle: DOMRect): Rectangle {
  const { viewport } = app;
  const { left, top, right, bottom } = domRectangle;

  // adjust for canvas screen position
  const canvas = app.renderer.view.getBoundingClientRect();

  const topLeft = viewport.toWorld(new Point(left, top - canvas.top));
  const bottomRight = viewport.toWorld(new Point(right, bottom - canvas.top));

  return new Rectangle(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
}