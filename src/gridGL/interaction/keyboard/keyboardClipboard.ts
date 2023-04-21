import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { PNG_MESSAGE } from '../../../constants/app';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  pasteFromClipboard,
} from '../../../grid/actions/clipboard/clipboard';
import { SheetController } from '../../../grid/controller/sheetController';
import { GlobalSnackbar } from '../../../ui/contexts/GlobalSnackbar';
import { PixiApp } from '../../pixiApp/PixiApp';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  interactionState: GridInteractionState;
  sheet_controller: SheetController;
  app: PixiApp;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
}): boolean {
  const { addGlobalSnackbar, event, interactionState, sheet_controller, app } = props;

  // Command + V
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyV') {
    pasteFromClipboard(sheet_controller, {
      x: interactionState.cursorPosition.x,
      y: interactionState.cursorPosition.y,
    });
    return true;
  }

  // Command + Shift + C
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'KeyC') {
    copySelectionToPNG(app);
    addGlobalSnackbar(PNG_MESSAGE);
    event.preventDefault();
    event.stopPropagation();
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
