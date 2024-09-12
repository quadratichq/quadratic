import { Coordinate } from '@/app/gridGL/types/size';
import { focusGrid } from '@/app/helpers/focusGrid.js';
import { CodeCellLanguage, SearchOptions } from '@/app/quadratic-core-types';
import { FilePermission } from 'quadratic-shared/typesAndSchemas';
import { atom, DefaultValue, selector } from 'recoil';

export type EditorInteractionState = {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  showCommandPalette: boolean;
  showConnectionsMenu: boolean;
  showGoToMenu: boolean;
  showFeedbackMenu: boolean;
  showNewFileMenu: boolean;
  showRenameFileMenu: boolean;
  showShareFileMenu: boolean;
  showSearch: boolean | SearchOptions;
  showValidation: boolean | string;
  showAI: boolean;
  annotationState?: 'dropdown';
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
};

export const editorInteractionStateDefault: EditorInteractionState = {
  showCellTypeMenu: false,
  showCodeEditor: false,
  showCommandPalette: false,
  showConnectionsMenu: false,
  showGoToMenu: false,
  showFeedbackMenu: false,
  showNewFileMenu: false,
  showRenameFileMenu: false,
  showShareFileMenu: false,
  showSearch: false,
  showContextMenu: false,
  showValidation: false,
  showAI: true,
  permissions: ['FILE_VIEW'], // FYI: when we call <RecoilRoot> we initialize this with the value from the server
  uuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  selectedCell: { x: 0, y: 0 },
  selectedCellSheet: '',
  initialCode: undefined,
  mode: undefined,
  undo: false,
  redo: false,
};

export const editorInteractionStateAtom = atom<EditorInteractionState>({
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
          oldValue.showNewFileMenu ||
          oldValue.showRenameFileMenu ||
          oldValue.showShareFileMenu ||
          oldValue.showSearch ||
          oldValue.showAI;
        const newModelShow =
          newValue.showCellTypeMenu ||
          newValue.showCodeEditor ||
          newValue.showCommandPalette ||
          newValue.showConnectionsMenu ||
          newValue.showGoToMenu ||
          newValue.showFeedbackMenu ||
          newValue.showNewFileMenu ||
          newValue.showRenameFileMenu ||
          newValue.showShareFileMenu ||
          newValue.showSearch ||
          newValue.showAI;
        if (oldModalShow && !newModelShow) {
          focusGrid();
        }
      });
    },
  ],
});

export const showAIAtom = selector<EditorInteractionState['showAI']>({
  key: 'showAIAtom',
  get: ({ get }) => {
    const editorInteractionState = get(editorInteractionStateAtom);
    return editorInteractionState.showAI;
  },
  set: ({ set }, newValue) => {
    set(editorInteractionStateAtom, (prev) => ({
      ...prev,
      showAI: newValue instanceof DefaultValue ? prev.showAI : newValue,
    }));
  },
});
