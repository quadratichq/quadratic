import { atom } from 'recoil';
import { ApiTypes } from '../api/types';
import { Coordinate } from '../gridGL/types/size';
import { CellType } from '../schemas';

export interface EditorInteractionState {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  showCommandPalette: boolean;
  showGoToMenu: boolean;
  showFeedbackMenu: boolean;
  showShareFileMenu: boolean;
  permission: ApiTypes['/v0/files/:uuid.GET.response']['permission'];
  selectedCell: Coordinate;
  mode: CellType;
}

export const editorInteractionStateDefault: EditorInteractionState = {
  showCellTypeMenu: false,
  showCodeEditor: false,
  showCommandPalette: false,
  showGoToMenu: false,
  showFeedbackMenu: false,
  showShareFileMenu: false,
  permission: 'VIEWER',
  selectedCell: { x: 0, y: 0 },
  mode: 'TEXT',
};

export const editorInteractionStateAtom = atom({
  key: 'editorInteractionState', // unique ID (with respect to other atoms/selectors)
  default: editorInteractionStateDefault,
});
