import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from '../pixiApp/PixiApp';

// When the cursor moves ensure it is visible
export function ensureVisible(props: {
  app?: PixiApp,
  interactionState: GridInteractionState;
}): void {
  const { interactionState, app } = props;
  if (!app) return;
  const viewport = app.viewport;
  const headingSize = app.headings.headingSize;

  if (!interactionState.showMultiCursor) {
    let dirty = false;
    const cell = app.gridOffsets.getCell(interactionState.cursorPosition.x, interactionState.cursorPosition.y);
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
      viewport.emit('moved');
    }
  }
}
