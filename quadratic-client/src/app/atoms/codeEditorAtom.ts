import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Coordinate, SheetPosTS } from '@/app/gridGL/types/size';
import { SheetRect } from '@/app/quadratic-core-types';
import { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { AIMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

export interface ConsoleOutput {
  stdOut?: string;
  stdErr?: string;
}

interface CodeEditorState {
  aiAssistant: {
    abortController?: AbortController;
    loading: boolean;
    messages: (UserMessage | AIMessage)[];
    prompt: string;
  };
  loading: boolean;
  cellLocation?: SheetPosTS;
  codeString?: string;
  evaluationResult?: EvaluationResult;
  consoleOutput?: ConsoleOutput;
  spillError?: Coordinate[];
  panelBottomActiveTab: PanelTab;
  showSnippetsPopover: boolean;
  editorContent?: string;
  showSaveChangesAlert: boolean;
  cellsAccessed: SheetRect[] | undefined | null;
}

const defaultCodeEditorState: CodeEditorState = {
  aiAssistant: {
    abortController: undefined,
    loading: false,
    messages: [],
    prompt: '',
  },
  loading: false,
  cellLocation: undefined,
  codeString: undefined,
  evaluationResult: undefined,
  consoleOutput: undefined,
  spillError: undefined,
  panelBottomActiveTab: 'ai-assistant',
  showSnippetsPopover: false,
  editorContent: undefined,
  showSaveChangesAlert: false,
  cellsAccessed: undefined,
};

export const codeEditorAtom = atom<CodeEditorState>({
  key: 'codeEditorAtom',
  default: defaultCodeEditorState,
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

export const codeEditorLoadingAtom = createSelector('loading');
export const codeEditorCellLocationAtom = createSelector('cellLocation');
export const codeEditorCodeStringAtom = createSelector('codeString');
export const codeEditorEvaluationResultAtom = createSelector('evaluationResult');
export const codeEditorConsoleOutputAtom = createSelector('consoleOutput');
export const codeEditorSpillErrorAtom = createSelector('spillError');
export const codeEditorPanelBottomActiveTabAtom = createSelector('panelBottomActiveTab');
export const codeEditorShowSnippetsPopoverAtom = createSelector('showSnippetsPopover');
export const codeEditorEditorContentAtom = createSelector('editorContent');
export const codeEditorShowSaveChangesAlertAtom = createSelector('showSaveChangesAlert');
export const codeEditorCellsAccessedAtom = createSelector('cellsAccessed');
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
