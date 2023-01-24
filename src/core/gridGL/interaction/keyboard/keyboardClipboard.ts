import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../../actions/clipboard';
import { SheetController } from '../../../transaction/sheetController';

export function keyboardClipboard(
  event: React.KeyboardEvent<HTMLElement>,
  interactionState: GridInteractionState,
  sheet_controller: SheetController
): boolean {
  // Command + V
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyV') {
    pasteFromClipboard(sheet_controller, {
      x: interactionState.cursorPosition.x,
      y: interactionState.cursorPosition.y,
    });
    return true;
  }

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyC') {
    copyToClipboard(
      sheet_controller,
      {
        x: interactionState.multiCursorPosition.originPosition.x,
        y: interactionState.multiCursorPosition.originPosition.y,
      },
      {
        x: interactionState.multiCursorPosition.terminalPosition.x,
        y: interactionState.multiCursorPosition.terminalPosition.y,
      }
    );
    return true;
  }

  // Command + X
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyX') {
    cutToClipboard(
      sheet_controller,
      {
        x: interactionState.multiCursorPosition.originPosition.x,
        y: interactionState.multiCursorPosition.originPosition.y,
      },
      {
        x: interactionState.multiCursorPosition.terminalPosition.x,
        y: interactionState.multiCursorPosition.terminalPosition.y,
      }
    );
    return true;
  }

  return false;
}
