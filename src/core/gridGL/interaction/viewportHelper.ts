import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { HEADING_SIZE } from '../../../constants/gridConstants';
import { Sheet } from '../../gridDB/Sheet';
import { PixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';

// Ensures the cursor is always visible
export function ensureVisible(options: { app?: PixiApp; interactionState: GridInteractionState; sheet: Sheet }): void {
  const { interactionState, app, sheet } = options;
  if (!app) return;
  const { viewport, headings } = app;
  const { gridOffsets } = sheet;
  const headingSize = headings.headingSize;

  const column = interactionState.keyboardMovePosition.x;
  const row = interactionState.keyboardMovePosition.y;
  const cell = gridOffsets.getCell(column, row);
  let dirty = false;

  if (cell.x + headingSize.width < viewport.left) {
    viewport.left = cell.x - headingSize.width / viewport.scale.x;
    dirty = true;
  } else if (cell.x + cell.width > viewport.right) {
    viewport.right = cell.x + cell.width;
    dirty = true;
  }

  if (cell.y < viewport.top + headingSize.height / viewport.scale.y) {
    viewport.top = cell.y - headingSize.height / viewport.scale.y;
    dirty = true;
  } else if (cell.y + cell.height > viewport.bottom) {
    viewport.bottom = cell.y + cell.height;
    dirty = true;
  }

  if (dirty) {
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
export function moveViewport(options: { app?: PixiApp; center?: Coordinate, topLeft?: Coordinate }): void {
  const { app, center, topLeft } = options;
  if (!app || (!center && !topLeft)) return;

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