import { GlobalSnackbar } from '../../../components/GlobalSnackbar';
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
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
}): boolean {
  const { addGlobalSnackbar, event } = props;
  const cursor = sheetController.sheet.cursor;

  // Command + V
  if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
    pasteFromClipboard({
      x: cursor.cursorPosition.x,
      y: cursor.cursorPosition.y,
    });
    return true;
  }

  // Command + Shift + C
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'c') {
    copySelectionToPNG();
    addGlobalSnackbar(PNG_MESSAGE);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const start = cursor.originPosition;
  const end = cursor.terminalPosition;

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
    copyToClipboard(start, end);
    return true;
  }

  // Command + X
  if ((event.metaKey || event.ctrlKey) && event.key === 'x') {
    cutToClipboard(start, end);
    return true;
  }

  return false;
}
