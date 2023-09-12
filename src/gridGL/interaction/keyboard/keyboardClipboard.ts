import { isEditorOrAbove } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { GlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { PNG_MESSAGE } from '../../../constants/appConstants';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  pasteFromClipboard,
} from '../../../grid/actions/clipboard/clipboard';
import { sheetController } from '../../../grid/controller/SheetController';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  editorInteractionState: EditorInteractionState;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
}): boolean {
  const {
    addGlobalSnackbar,
    event,
    editorInteractionState: { permission },
  } = props;

  // Command + Shift + C
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'c') {
    copySelectionToPNG();
    addGlobalSnackbar(PNG_MESSAGE);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const cursor = sheetController.sheet.cursor;

  const start = cursor.originPosition;
  const end = cursor.terminalPosition;

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
    copyToClipboard(start, end);
    return true;
  }

  // Don't allow commands past here without permission
  if (!isEditorOrAbove(permission)) {
    return false;
  }

  // Command + X
  if ((event.metaKey || event.ctrlKey) && event.key === 'x') {
    cutToClipboard(start, end);
    return true;
  }

  // Command + V
  if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
    pasteFromClipboard(cursor.originPosition);
    return true;
  }

  return false;
}
