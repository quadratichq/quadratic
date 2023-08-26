import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { GlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { PNG_MESSAGE } from '../../../constants/appConstants';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  pasteFromClipboard,
} from '../../../grid/actions/clipboard/clipboard';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../pixiApp/PixiApp';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  editorInteractionState: EditorInteractionState;
  interactionState: GridInteractionState;
  sheet_controller: SheetController;
  app: PixiApp;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
}): boolean {
  const {
    addGlobalSnackbar,
    event,
    interactionState,
    sheet_controller,
    app,
    editorInteractionState: { permission },
  } = props;

  // Command + Shift + C
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'c') {
    copySelectionToPNG(app);
    addGlobalSnackbar(PNG_MESSAGE);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
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

  // Don't allow commands past here if they don't have the permission
  if (permission === 'ANONYMOUS' || permission === 'VIEWER') {
    return false;
  }

  // Command + X
  if ((event.metaKey || event.ctrlKey) && event.key === 'x') {
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

  // Command + V
  if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
    pasteFromClipboard(sheet_controller, {
      x: interactionState.cursorPosition.x,
      y: interactionState.cursorPosition.y,
    });
    return true;
  }

  return false;
}
