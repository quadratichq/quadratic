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
  sheet_controller: SheetController;
  app: PixiApp;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
}): boolean {
  const { addGlobalSnackbar, event, sheet_controller, app } = props;
  const cursor = sheet_controller.sheet.cursor;

  // Command + V
  if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
    pasteFromClipboard(sheet_controller, {
      x: cursor.cursorPosition.x,
      y: cursor.cursorPosition.y,
    });
    return true;
  }

  // Command + Shift + C
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'c') {
    copySelectionToPNG(app);
    addGlobalSnackbar(PNG_MESSAGE);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const start = cursor.originPosition;
  const end = cursor.terminalPosition;

  // Command + C
  if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
    copyToClipboard(sheet_controller, start, end);
    return true;
  }

  // Command + X
  if ((event.metaKey || event.ctrlKey) && event.key === 'x') {
    cutToClipboard(sheet_controller, start, end);
    return true;
  }

  return false;
}
