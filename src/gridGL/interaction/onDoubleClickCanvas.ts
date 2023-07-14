import { EditorInteractionState } from '../../atoms/editorInteractionStateAtom';
import { Sheet } from '../../grid/sheet/Sheet';
import { pixiAppEvents } from '../pixiApp/PixiAppEvents';

export const onDoubleClickCanvas = (
  event: PointerEvent,
  sheet: Sheet,
  editorInteractionState: EditorInteractionState,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
) => {
  const cursor = sheet.cursor;

  // Get the double clicked cell, check if it is already set
  const x = cursor.cursorPosition.x;
  const y = cursor.cursorPosition.y;
  const cell = sheet.getCellCopy(x, y);
  if (cell) {
    // open single line, for TEXT and COMPUTED
    if (cell.type === 'TEXT' || cell.type === 'COMPUTED') {
      pixiAppEvents.changeInput(true, cell.value);
    } else {
      // Open code editor, or move code editor if already open.
      setEditorInteractionState({
        ...editorInteractionState,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: x, y: y },
        mode: cell.type,
      });
    }
  } else {
    // If no previous value, open single line Input
    pixiAppEvents.changeInput(true);
  }
  event.preventDefault();
};
