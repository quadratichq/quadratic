import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { Sheet } from '../../gridDB/Sheet';

export const onDoubleClickCanvas = (
  event: PointerEvent,
  sheet: Sheet,
  interactionState: GridInteractionState,
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>,
  editorInteractionState: EditorInteractionState,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
) => {
  // Get the double clicked cell, check if it is already set
  const x = interactionState.cursorPosition.x;
  const y = interactionState.cursorPosition.y;
  const cell = sheet.getCellCopy(x, y);
  if (cell) {
    // open single line, for TEXT and COMPUTED
    if (cell.type === 'TEXT' || cell.type === 'COMPUTED') {
      setInteractionState({
        ...interactionState,
        ...{
          showInput: true,
          inputInitialValue: cell.value,
        },
      });
    } else {
      // Open code editor, or move code editor if already open.
      setEditorInteractionState({
        showCommandPalette: false,
        showCellTypeMenu: false,
        showCodeEditor: true,
        selectedCell: { x: x, y: y },
        mode: cell.type,
      });
    }
  } else {
    // If no previous value, open single line Input
    setInteractionState({
      ...interactionState,
      ...{
        showInput: true,
        inputInitialValue: '',
      },
    });
  }
  event.preventDefault();
};
