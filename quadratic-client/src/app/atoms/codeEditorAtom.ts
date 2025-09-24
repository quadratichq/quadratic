import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { JsCellsAccessed, JsCoordinate } from '@/app/quadratic-core-types';
import type { CodeCell } from '@/app/shared/types/codeCell';
import type { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import type { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

export interface ConsoleOutput {
  stdOut?: string;
  stdErr?: string;
}

export interface CodeEditorState {
  aiAssistant: {
    abortController?: AbortController;
    loading: boolean;
    id: string;
    messages: ChatMessage[];
    waitingOnMessageIndex?: number;
  };
  showCodeEditor: boolean;
  escapePressed: boolean;
  loading: boolean;
  codeCell: CodeCell;
  codeString?: string;
  evaluationResult?: EvaluationResult;
  consoleOutput?: ConsoleOutput;
  spillError?: JsCoordinate[];
  panelBottomActiveTab: PanelTab;
  showSnippetsPopover: boolean;
  initialCode?: string;
  editorContent?: string;
  diffEditorContent?: {
    editorContent?: string;
    isApplied: boolean;
  };
  showSaveChangesAlert: boolean;
  cellsAccessed: JsCellsAccessed[] | null;
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
    id: '',
    messages: [],
    waitingOnMessageIndex: undefined,
  },
  showCodeEditor: false,
  escapePressed: false,
  loading: false,
  codeCell: {
    sheetId: '',
    pos: { x: 1, y: 1 },
    language: 'Python',
    lastModified: 0,
  },
  codeString: undefined,
  evaluationResult: undefined,
  consoleOutput: undefined,
  spillError: undefined,
  panelBottomActiveTab: 'console',
  showSnippetsPopover: false,
  initialCode: undefined,
  editorContent: undefined,
  diffEditorContent: undefined,
  showSaveChangesAlert: false,
  cellsAccessed: null,
  waitingForEditorClose: undefined,
};

export const codeEditorAtom = atom<CodeEditorState>({
  key: 'codeEditorAtom',
  default: defaultCodeEditorState,
  effects: [
    ({ onSet, resetSelf }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) {
          return;
        }

        if (newValue.showCodeEditor) {
          if (
            newValue.codeCell.sheetId !== oldValue.codeCell.sheetId ||
            newValue.codeCell.pos.x !== oldValue.codeCell.pos.x ||
            newValue.codeCell.pos.y !== oldValue.codeCell.pos.y ||
            newValue.codeCell.language !== oldValue.codeCell.language
          ) {
            events.emit('codeEditorCodeCell', newValue.codeCell);
          }
        }

        if (oldValue.showCodeEditor && !newValue.showCodeEditor) {
          oldValue.aiAssistant.abortController?.abort();
          events.emit('codeEditorCodeCell', undefined);
          resetSelf();
          focusGrid();
        }
      });
    },
  ],
});

const createAIAssistantSelector = <T extends keyof CodeEditorState['aiAssistant']>(key: T) =>
  selector<CodeEditorState['aiAssistant'][T]>({
    key: `codeEditorAIAssistant${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(codeEditorAtom).aiAssistant[key],
    set: ({ set }, newValue) =>
      set(codeEditorAtom, (prev) => ({
        ...prev,
        aiAssistant: {
          ...prev.aiAssistant,
          [key]: newValue instanceof DefaultValue ? prev.aiAssistant[key] : newValue,
        },
      })),
  });
export const aiAssistantAbortControllerAtom = createAIAssistantSelector('abortController');
export const aiAssistantLoadingAtom = createAIAssistantSelector('loading');
export const aiAssistantIdAtom = createAIAssistantSelector('id');
export const aiAssistantMessagesAtom = createAIAssistantSelector('messages');
export const aiAssistantMessagesCountAtom = selector<number>({
  key: 'aiAssistantMessagesCountAtom',
  get: ({ get }) => get(aiAssistantMessagesAtom).length,
});
export const aiAssistantWaitingOnMessageIndexAtom = selector<number | undefined>({
  key: 'aiAssistantWaitingOnMessageIndexAtom',
  get: ({ get }) => get(codeEditorAtom).aiAssistant.waitingOnMessageIndex,
  set: ({ set }, newValue) => {
    set(codeEditorAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      return {
        ...prev,
        aiAssistant: {
          ...prev.aiAssistant,
          waitingOnMessageIndex: newValue,
        },
      };
    });
  },
});

export const aiAssistantCurrentChatMessagesCountAtom = selector<number>({
  key: 'aiAssistantCurrentChatMessagesCountAtom',
  get: ({ get }) => get(aiAssistantMessagesAtom).length,
});

const createCodeEditorSelector = <T extends keyof CodeEditorState>(key: T) =>
  selector<CodeEditorState[T]>({
    key: `codeEditor${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(codeEditorAtom)[key],
    set: ({ set }, newValue) =>
      set(codeEditorAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });
export const codeEditorAiAssistantAtom = createCodeEditorSelector('aiAssistant');
export const codeEditorShowCodeEditorAtom = createCodeEditorSelector('showCodeEditor');
export const codeEditorEscapePressedAtom = createCodeEditorSelector('escapePressed');
export const codeEditorLoadingAtom = createCodeEditorSelector('loading');
export const codeEditorCodeCellAtom = createCodeEditorSelector('codeCell');
export const codeEditorCodeStringAtom = createCodeEditorSelector('codeString');
export const codeEditorEvaluationResultAtom = createCodeEditorSelector('evaluationResult');
export const codeEditorConsoleOutputAtom = createCodeEditorSelector('consoleOutput');
export const codeEditorSpillErrorAtom = createCodeEditorSelector('spillError');
export const codeEditorPanelBottomActiveTabAtom = createCodeEditorSelector('panelBottomActiveTab');
export const codeEditorShowSnippetsPopoverAtom = createCodeEditorSelector('showSnippetsPopover');
export const codeEditorInitialCodeAtom = createCodeEditorSelector('initialCode');
export const codeEditorDiffEditorContentAtom = createCodeEditorSelector('diffEditorContent');
export const codeEditorShowSaveChangesAlertAtom = createCodeEditorSelector('showSaveChangesAlert');
export const codeEditorCellsAccessedAtom = createCodeEditorSelector('cellsAccessed');
export const codeEditorWaitingForEditorClose = createCodeEditorSelector('waitingForEditorClose');

export const codeEditorEditorContentAtom = selector<string | undefined>({
  key: 'codeEditorEditorContentAtom',
  get: ({ get }) => get(codeEditorAtom).editorContent,
  set: ({ set }, newValue) =>
    set(codeEditorAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return { ...prev, diffEditorContent: undefined };
      }

      return {
        ...prev,
        diffEditorContent: undefined,
        editorContent: newValue,
      };
    }),
});

export const codeEditorShowDiffEditorAtom = selector<boolean>({
  key: 'codeEditorShowDiffEditorAtom',
  get: ({ get }) => {
    const { waitingForEditorClose, diffEditorContent, editorContent } = get(codeEditorAtom);

    return (
      waitingForEditorClose === undefined &&
      diffEditorContent !== undefined &&
      diffEditorContent.editorContent !== editorContent
    );
  },
});

export const codeEditorUnsavedChangesAtom = selector<boolean>({
  key: 'codeEditorUnsavedChangesAtom',
  get: ({ get }) => {
    const { editorContent, codeString } = get(codeEditorAtom);
    return editorContent !== codeString;
  },
});

export const showAIAssistantAtom = selector<boolean>({
  key: 'showAIAssistantAtom',
  get: ({ get }) => {
    const codeEditorState = get(codeEditorAtom);
    return codeEditorState.showCodeEditor && codeEditorState.panelBottomActiveTab === 'ai-assistant';
  },
  set: ({ set }, newValue) => {
    if (newValue instanceof DefaultValue) {
      return;
    }

    set(codeEditorAtom, (prev) => ({
      ...prev,
      showCodeEditor: newValue,
      panelBottomActiveTab: newValue ? 'ai-assistant' : prev.panelBottomActiveTab,
    }));
  },
});
