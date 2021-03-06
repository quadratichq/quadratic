import { atom } from 'recoil';
import CellReference from '../core/gridGL/types/cellReference';
import { CellTypes } from '../core/gridDB/db';

export interface EditorInteractionState {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  selectedCell: CellReference;
  mode: CellTypes;
}

export const editorInteractionStateAtom = atom({
  key: 'editorInteractionState', // unique ID (with respect to other atoms/selectors)
  default: {
    showCellTypeMenu: false,
    showCodeEditor: false,
    selectedCell: { x: 0, y: 0 },
    mode: 'TEXT',
  } as EditorInteractionState,
});
