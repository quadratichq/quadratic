import { Coordinate } from '@/app/gridGL/types/size';
import { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { AIMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

type CodeEditorState = {
  aiAssistant: {
    abortController?: AbortController;
    loading: boolean;
    messages: (UserMessage | AIMessage)[];
    prompt: string;
  };
  codeString?: string;
  evaluationResult?: EvaluationResult;
  consoleOutput?: { stdOut?: string; stdErr?: string };
  spillError?: Coordinate[];
  panelBottomActiveTab: PanelTab;
  showSnippetsPopover: boolean;
  editorContent?: string;
  modifiedEditorContent?: string;
};

const defaultCodeEditorState: CodeEditorState = {
  aiAssistant: {
    abortController: undefined,
    loading: false,
    messages: [],
    prompt: '',
  },
  codeString: undefined,
  evaluationResult: undefined,
  consoleOutput: undefined,
  spillError: undefined,
  panelBottomActiveTab: 'ai-assistant',
  showSnippetsPopover: false,
  editorContent: undefined,
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
export const codeEditorCodeStringAtom = createSelector('codeString');
export const codeEditorEvaluationResultAtom = createSelector('evaluationResult');
export const codeEditorConsoleOutputAtom = createSelector('consoleOutput');
export const codeEditorSpillErrorAtom = createSelector('spillError');
export const codeEditorPanelBottomActiveTabAtom = createSelector('panelBottomActiveTab');
export const codeEditorShowSnippetsPopoverAtom = createSelector('showSnippetsPopover');
export const codeEditorEditorContentAtom = createSelector('editorContent');

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
