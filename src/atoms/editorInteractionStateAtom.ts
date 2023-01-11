import { atom } from 'recoil';
import CellReference from '../core/gridGL/types/cellReference';
import { CellTypes } from '../core/gridDB/gridTypes';

export interface EditorInteractionState {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  selectedCell: CellReference;
  mode: CellTypes;
}

export const editorInteractionStateDefault: EditorInteractionState = {
  showCellTypeMenu: false,
  showCodeEditor: false,
  selectedCell: { x: 0, y: 0 },
  mode: 'TEXT',
};

export const editorInteractionStateAtom = atom({
  key: 'editorInteractionState', // unique ID (with respect to other atoms/selectors)
  default: editorInteractionStateDefault,
});
