import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { Coordinate } from '@/app/gridGL/types/size';
import { focusGrid } from '@/app/helpers/focusGrid';
import { SheetRect } from '@/app/quadratic-core-types';
import { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { AIMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

export interface ConsoleOutput {
  stdOut?: string;
  stdErr?: string;
}

export interface CodeEditorState {
  aiAssistant: {
    abortController?: AbortController;
    loading: boolean;
    messages: (UserMessage | AIMessage)[];
    prompt: string;
  };
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
  showSaveChangesAlert: boolean;
  cellsAccessed: SheetRect[] | undefined | null;
  waitingForEditorClose?: {
    codeCell: CodeCell;
    showCellTypeMenu: boolean;
    initialCode: string;
    inlineEditor?: boolean;
  };
}

export const defaultCodeEditorState: CodeEditorState = {
  aiAssistant: {
    abortController: undefined,
    loading: false,
    messages: [],
    prompt: '',
  },
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
  panelBottomActiveTab: 'ai-assistant',
  showSnippetsPopover: false,
  initialCode: undefined,
  editorContent: undefined,
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
export const codeEditorShowSaveChangesAlertAtom = createSelector('showSaveChangesAlert');
export const codeEditorCellsAccessedAtom = createSelector('cellsAccessed');
export const codeEditorWaitingForEditorClose = createSelector('waitingForEditorClose');

export const codeEditorUnsavedChangesAtom = selector<boolean>({
  key: 'codeEditorUnsavedChangesAtom',
  get: ({ get }) => {
    const unsavedChanges = get(codeEditorAtom).editorContent !== get(codeEditorAtom).codeString;
    pixiAppSettings.unsavedEditorChanges = unsavedChanges ? get(codeEditorAtom).editorContent : undefined;
    return unsavedChanges;
  },
});

const createAIAssistantSelector = <T extends keyof CodeEditorState['aiAssistant']>(key: T) =>
  selector<CodeEditorState['aiAssistant'][T]>({
    key: `codeEditorAIAssistant${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(codeEditorAtom).aiAssistant[key],
    set: ({ set }, newValue) =>
      set(codeEditorAtom, (prev) => ({
        ...prev,
        aiAssistant: { ...prev.aiAssistant, [key]: newValue },
      })),
  });
export const codeEditorAIAssistantAbortControllerAtom = createAIAssistantSelector('abortController');
export const codeEditorAIAssistantLoadingAtom = createAIAssistantSelector('loading');
export const codeEditorAIAssistantMessagesAtom = createAIAssistantSelector('messages');
export const codeEditorAIAssistantPromptAtom = createAIAssistantSelector('prompt');
