import { Coordinate } from '@/app/gridGL/types/size';
import { focusGrid } from '@/app/helpers/focusGrid.js';
import { CodeCellLanguage, SearchOptions } from '@/app/quadratic-core-types';
import { FilePermission } from 'quadratic-shared/typesAndSchemas';
import { atom, DefaultValue } from 'recoil';

export interface EditorInteractionState {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  showCommandPalette: boolean;
  showConnectionsMenu: boolean;
  showGoToMenu: boolean;
  showFeedbackMenu: boolean;
  showShareFileMenu: boolean;
  showSearch: boolean | SearchOptions;
  showValidation: boolean | string;
  annotationState?: 'dropdown' | 'date-format';
  showContextMenu: boolean;
  permissions: FilePermission[];
  uuid: string;
  selectedCell: Coordinate;
  selectedCellSheet: string;
  mode?: CodeCellLanguage;
  initialCode?: string;
  follow?: string;
  editorEscapePressed?: boolean;
  waitingForEditorClose?: {
    selectedCell: Coordinate;
    selectedCellSheet: string;
    mode?: CodeCellLanguage;
    showCellTypeMenu: boolean;
    inlineEditor?: boolean;
    initialCode?: string;
  };
  undo: boolean;
  redo: boolean;
}

export const editorInteractionStateDefault: EditorInteractionState = {
  showCellTypeMenu: false,
  showCodeEditor: false,
  showCommandPalette: false,
  showConnectionsMenu: false,
  showGoToMenu: false,
  showFeedbackMenu: false,
  showShareFileMenu: false,
  showSearch: false,
  showContextMenu: false,
  showValidation: false,
  annotationState: 'date-format',
  permissions: ['FILE_VIEW'], // FYI: when we call <RecoilRoot> we initialize this with the value from the server
  uuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  selectedCell: { x: 0, y: 0 },
  selectedCellSheet: '',
  initialCode: undefined,
  mode: undefined,
  undo: false,
  redo: false,
};

export const editorInteractionStateAtom = atom({
  key: 'editorInteractionState', // unique ID (with respect to other atoms/selectors)
  default: editorInteractionStateDefault,
  effects: [
    // this effect is used to focus the grid when the modal is closed
    ({ onSet }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) return;
        const oldModalShow =
          oldValue.showCellTypeMenu ||
          oldValue.showCodeEditor ||
          oldValue.showCommandPalette ||
          oldValue.showConnectionsMenu ||
          oldValue.showGoToMenu ||
          oldValue.showFeedbackMenu ||
          oldValue.showShareFileMenu ||
          oldValue.showSearch;
        const newModelShow =
          newValue.showCellTypeMenu ||
          newValue.showCodeEditor ||
          newValue.showCommandPalette ||
          newValue.showConnectionsMenu ||
          newValue.showGoToMenu ||
          newValue.showFeedbackMenu ||
          newValue.showShareFileMenu ||
          newValue.showSearch;
        if (oldModalShow && !newModelShow) {
          focusGrid();
        }
      });
    },
  ],
});
