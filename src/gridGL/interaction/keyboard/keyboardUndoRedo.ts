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
    ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'KeyZ') ||
    (!isMac && (event.metaKey || event.ctrlKey) && event.code === 'KeyY')
  ) {
    sheetController.redo();
    event.preventDefault();
    return true;
  }

  // Undo
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
    sheetController.undo();
    event.preventDefault();
    return true;
  }

  return false;
}
