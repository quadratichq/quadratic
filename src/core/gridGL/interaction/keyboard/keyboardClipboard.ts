import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { copyToClipboard, pasteFromClipboard } from '../../../actions/clipboard';

export function keyboardClipboard(
  event: React.KeyboardEvent<HTMLElement>,
  interactionState: GridInteractionState
): boolean {
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyV') {
    pasteFromClipboard({
      x: interactionState.cursorPosition.x,
      y: interactionState.cursorPosition.y,
    });
    return true;
  }

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyC') {
    copyToClipboard(
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
