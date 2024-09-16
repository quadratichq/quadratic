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
  showContextMenu: boolean;
  showValidation: boolean | string;
  showAIAssistant: boolean;
  annotationState?: 'dropdown' | 'date-format' | 'calendar' | 'calendar-time';
  permissions: FilePermission[];
  uuid: string;
  selectedCellSheet: string;
  selectedCell: Coordinate;
  mode?: CodeCellLanguage;
  initialCode?: string;
  follow?: string;
  editorEscapePressed?: boolean;
  waitingForEditorClose?: {
    selectedCellSheet: string;
    selectedCell: Coordinate;
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
  showAIAssistant: true,
  annotationState: undefined,
  permissions: ['FILE_VIEW'], // FYI: when we call <RecoilRoot> we initialize this with the value from the server
  uuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  selectedCellSheet: '',
  selectedCell: { x: 0, y: 0 },
  mode: undefined,
  initialCode: undefined,
  follow: undefined,
  editorEscapePressed: undefined,
  waitingForEditorClose: undefined,
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
          oldValue.showAIAssistant;
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
          newValue.showAIAssistant;
        if (oldModalShow && !newModelShow) {
          focusGrid();
        }
      });
    },
  ],
});

const createSelector = <T extends keyof EditorInteractionState>(key: T) =>
  selector<EditorInteractionState[T]>({
    key: `editorInteractionState${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(editorInteractionStateAtom)[key],
    set: ({ set }, newValue) =>
      set(editorInteractionStateAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });

export const editorInteractionStateShowCellTypeMenuAtom = createSelector('showCellTypeMenu');
export const editorInteractionStateShowCodeEditorAtom = createSelector('showCodeEditor');
export const editorInteractionStateShowCommandPaletteAtom = createSelector('showCommandPalette');
export const editorInteractionStateShowConnectionsMenuAtom = createSelector('showConnectionsMenu');
export const editorInteractionStateShowGoToMenuAtom = createSelector('showGoToMenu');
export const editorInteractionStateShowFeedbackMenuAtom = createSelector('showFeedbackMenu');
export const editorInteractionStateShowNewFileMenuAtom = createSelector('showNewFileMenu');
export const editorInteractionStateShowRenameFileMenuAtom = createSelector('showRenameFileMenu');
export const editorInteractionStateShowShareFileMenuAtom = createSelector('showShareFileMenu');
export const editorInteractionStateShowSearchAtom = createSelector('showSearch');
export const editorInteractionStateShowContextMenuAtom = createSelector('showContextMenu');
export const editorInteractionStateShowValidationAtom = createSelector('showValidation');
export const editorInteractionStateShowAIAssistantAtom = createSelector('showAIAssistant');

export const editorInteractionStateAnnotationStateAtom = createSelector('annotationState');
export const editorInteractionStatePermissionsAtom = createSelector('permissions');
export const editorInteractionStateSelectedCellSheetAtom = createSelector('selectedCellSheet');
export const editorInteractionStateSelectedCellAtom = createSelector('selectedCell');
export const editorInteractionStateInitialCodeAtom = createSelector('initialCode');
export const editorInteractionStateFollowAtom = createSelector('follow');
export const editorInteractionStateModeAtom = createSelector('mode');
export const editorInteractionStateEditorEscapePressedAtom = createSelector('editorEscapePressed');
export const editorInteractionStateWaitingForEditorCloseAtom = createSelector('waitingForEditorClose');
