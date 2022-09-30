import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { GetCellsDB } from '../../gridDB/Cells/GetCellsDB';
import { match } from '../../../utils/match';
import { Cell } from '../../gridDB/db';

export const onDoubleClickCanvas = async (
  event: PointerEvent,
  interactionState: GridInteractionState,
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
) => {
  // Get the double clicked cell, check if it is already set
  const x = interactionState.cursorPosition.x;
  const y = interactionState.cursorPosition.y;
  const cells = await GetCellsDB(x, y, x, y);

  const openSingleLineInputTextOrComputed = (cell: Cell): void => {
      setInteractionState({
        ...interactionState,
        ...{
          showInput: true,
          inputInitialValue: cell.value,
        },
      });
  };

  const openCodeEditor = (cell: Cell): void => {
    setEditorInteractionState({
      showCellTypeMenu: false,
      showCodeEditor: true,
      selectedCell: { x: x, y: y },
      mode: cell.type,
    });
  };

  const openSingleLineEditor = (): void => {
    setInteractionState({
      ...interactionState,
      ...{
        showInput: true,
        inputInitialValue: '',
      },
    });
  };

  const moveToOrigin = (): void => {
    setInteractionState({
      ...interactionState,
      ...{
        cursorPosition: { x: 0, y: 0}
      }
    })
  }

  const cellIsTextOrComputed = (cell: Cell) => cell?.type === 'TEXT' || cell?.type === 'COMPUTED';
  const cellIsSetBranch = (cell: Cell) => match(cell)
    .on(x => cellIsTextOrComputed(x), () => openSingleLineInputTextOrComputed(cell))
    .otherwise(() => openCodeEditor(cell));

  match(cells)
    .on(x => x.length > 0, () => cellIsSetBranch(cells[0]))
    .on(_ => x === -1 && y === -1, () => moveToOrigin())
    .otherwise(() => openSingleLineEditor())

  event.preventDefault();
};

