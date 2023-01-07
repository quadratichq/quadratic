import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../transaction/sheetController';

export function keyboardUndoRedo(
  event: React.KeyboardEvent<HTMLElement>,
  interactionState: GridInteractionState,
  sheetController: SheetController
): boolean {
  // Command + Shift + Z
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'KeyZ') {
    sheetController.redo();
    return true;
  }

  // Command + Z
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
    sheetController.undo();
    return true;
  }

  return false;
}
