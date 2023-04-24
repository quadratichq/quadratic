import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { isMac } from '../../../utils/isMac';

export function keyboardUndoRedo(
  event: React.KeyboardEvent<HTMLElement>,
  interactionState: GridInteractionState,
  sheetController: SheetController
): boolean {
  // Redo
  if (
    ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'z') ||
    ((event.metaKey || event.ctrlKey) && event.key === 'y' && !isMac)
  ) {
    sheetController.redo();
    event.preventDefault();
    return true;
  }

  // Undo
  if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
    sheetController.undo();
    event.preventDefault();
    return true;
  }

  return false;
}
