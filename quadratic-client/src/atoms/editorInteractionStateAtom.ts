import { Coordinate } from '@/gridGL/types/size';
import { CellType } from '@/schemas';
import { Permission } from 'quadratic-shared/typesAndSchemas';
import { atom } from 'recoil';

export interface EditorInteractionState {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  showCommandPalette: boolean;
  showGoToMenu: boolean;
  showFeedbackMenu: boolean;
  showShareFileMenu: boolean;
  permission: Permission;
  uuid: string;
  selectedCell: Coordinate;
  selectedCellSheet: string;
  mode: CellType;
  follow?: string;
}

export const editorInteractionStateDefault: EditorInteractionState = {
  showCellTypeMenu: false,
  showCodeEditor: false,
  showCommandPalette: false,
  showGoToMenu: false,
  showFeedbackMenu: false,
  showShareFileMenu: false,
  permission: 'FILE_VIEW', // FYI: when we call <RecoilRoot> we initialize this with the value from the server
  uuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  selectedCell: { x: 0, y: 0 },
  selectedCellSheet: '',
  mode: 'TEXT',
};

export const editorInteractionStateAtom = atom({
  key: 'editorInteractionState', // unique ID (with respect to other atoms/selectors)
  default: editorInteractionStateDefault,
});
