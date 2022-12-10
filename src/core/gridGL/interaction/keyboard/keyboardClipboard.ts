import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { copyToClipboard, pasteFromClipboard } from '../../../actions/clipboard';
import { Sheet } from '../../../gridDB/Sheet';

export function keyboardClipboard(
  event: React.KeyboardEvent<HTMLElement>,
  interactionState: GridInteractionState,
  sheet: Sheet
): boolean {
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyV') {
    pasteFromClipboard(sheet, {
      x: interactionState.cursorPosition.x,
      y: interactionState.cursorPosition.y,
    });
    return true;
  }

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyC') {
    copyToClipboard(
      sheet,
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
