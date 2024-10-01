import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { Coordinate } from '@/app/gridGL/types/size';
import { focusGrid } from '@/app/helpers/focusGrid';
import { SheetRect } from '@/app/quadratic-core-types';
import { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { atom, DefaultValue, selector } from 'recoil';

export interface ConsoleOutput {
  stdOut?: string;
  stdErr?: string;
}

export interface CodeEditorState {
  showCodeEditor: boolean;
  escapePressed: boolean;
  loading: boolean;
  codeCell: CodeCell;
  codeString?: string;
  evaluationResult?: EvaluationResult;
  consoleOutput?: ConsoleOutput;
  spillError?: Coordinate[];
  panelBottomActiveTab: PanelTab;
  showSnippetsPopover: boolean;
  initialCode?: string;
  editorContent?: string;
  modifiedEditorContent?: string;
  showSaveChangesAlert: boolean;
  cellsAccessed?: SheetRect[] | null;
  waitingForEditorClose?: {
    codeCell: CodeCell;
    showCellTypeMenu: boolean;
    initialCode: string;
    inlineEditor?: boolean;
  };
}

export const defaultCodeEditorState: CodeEditorState = {
  showCodeEditor: false,
  escapePressed: false,
  loading: false,
  codeCell: {
    sheetId: '',
    pos: { x: 0, y: 0 },
    language: 'Python',
  },
  codeString: undefined,
  evaluationResult: undefined,
  consoleOutput: undefined,
  spillError: undefined,
  panelBottomActiveTab: 'console',
  showSnippetsPopover: false,
  initialCode: undefined,
  editorContent: undefined,
  modifiedEditorContent: undefined,
  showSaveChangesAlert: false,
  cellsAccessed: undefined,
  waitingForEditorClose: undefined,
};

export const codeEditorAtom = atom<CodeEditorState>({
  key: 'codeEditorAtom',
  default: defaultCodeEditorState,
});

export const codeEditorShowCodeEditorAtom = selector<CodeEditorState['showCodeEditor']>({
  key: 'codeEditorShowCodeEditorAtom',
  get: ({ get }) => get(codeEditorAtom)['showCodeEditor'],
  set: ({ set }, newValue) =>
    set(codeEditorAtom, (prev) => {
      if (prev.showCodeEditor && !newValue) {
        focusGrid();
      }
      if (!newValue) {
        return defaultCodeEditorState;
      }
      return {
        ...prev,
        showCodeEditor: newValue instanceof DefaultValue ? prev['showCodeEditor'] : newValue,
      };
    }),
});

const createSelector = <T extends keyof CodeEditorState>(key: T) =>
  selector<CodeEditorState[T]>({
    key: `codeEditor${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(codeEditorAtom)[key],
    set: ({ set }, newValue) =>
      set(codeEditorAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });
export const codeEditorEscapePressedAtom = createSelector('escapePressed');
export const codeEditorLoadingAtom = createSelector('loading');
export const codeEditorCodeCellAtom = createSelector('codeCell');
export const codeEditorCodeStringAtom = createSelector('codeString');
export const codeEditorEvaluationResultAtom = createSelector('evaluationResult');
export const codeEditorConsoleOutputAtom = createSelector('consoleOutput');
export const codeEditorSpillErrorAtom = createSelector('spillError');
export const codeEditorPanelBottomActiveTabAtom = createSelector('panelBottomActiveTab');
export const codeEditorShowSnippetsPopoverAtom = createSelector('showSnippetsPopover');
export const codeEditorInitialCodeAtom = createSelector('initialCode');
export const codeEditorEditorContentAtom = createSelector('editorContent');
export const codeEditorModifiedEditorContentAtom = createSelector('modifiedEditorContent');
export const codeEditorShowSaveChangesAlertAtom = createSelector('showSaveChangesAlert');
export const codeEditorCellsAccessedAtom = createSelector('cellsAccessed');
export const codeEditorWaitingForEditorClose = createSelector('waitingForEditorClose');

export const codeEditorShowDiffEditorAtom = selector<boolean>({
  key: 'codeEditorShowDiffEditorAtom',
  get: ({ get }) => {
    const { waitingForEditorClose, modifiedEditorContent, editorContent } = get(codeEditorAtom);

    return (
      waitingForEditorClose === undefined &&
      modifiedEditorContent !== undefined &&
      !!editorContent &&
      modifiedEditorContent !== editorContent
    );
  },
});

export const codeEditorUnsavedChangesAtom = selector<boolean>({
  key: 'codeEditorUnsavedChangesAtom',
  get: ({ get }) => {
    const { editorContent, codeString } = get(codeEditorAtom);
    const unsavedChanges = editorContent !== codeString;

    if (unsavedChanges) {
      pixiAppSettings.unsavedEditorChanges = editorContent;
    } else {
      pixiAppSettings.unsavedEditorChanges = undefined;
    }

    return unsavedChanges;
  },
});
