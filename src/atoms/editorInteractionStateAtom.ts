import { atom } from 'recoil';
import { Coordinate } from '../core/gridGL/types/size';
import { CellTypes } from '../core/gridDB/gridTypes';

export interface EditorInteractionState {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  showCommandPalette: boolean;
  selectedCell: Coordinate;
  mode: CellTypes;
}

export const editorInteractionStateDefault: EditorInteractionState = {
  showCellTypeMenu: false,
  showCodeEditor: false,
  showCommandPalette: false,
  selectedCell: { x: 0, y: 0 },
  mode: 'TEXT',
};

export const editorInteractionStateAtom = atom({
  key: 'editorInteractionState', // unique ID (with respect to other atoms/selectors)
  default: editorInteractionStateDefault,
});
