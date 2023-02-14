import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';

export function keyboardUndoRedo(
  event: React.KeyboardEvent<HTMLElement>,
  interactionState: GridInteractionState,
  sheetController: SheetController
): boolean {
  // Command + Shift + Z
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'KeyZ') {
    sheetController.redo();
    event.preventDefault();
    return true;
  }

  // Command + Z
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
    sheetController.undo();
    event.preventDefault();
    return true;
  }

  return false;
}
