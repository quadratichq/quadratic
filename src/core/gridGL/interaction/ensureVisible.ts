import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from '../pixiApp/PixiApp';

// Ensures the cursor is always visible
export function ensureVisible(props: {
  app?: PixiApp,
  interactionState: GridInteractionState;
}): void {
  const { interactionState, app } = props;
  if (!app) return;
  const { viewport, gridOffsets, headings } = app;
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
