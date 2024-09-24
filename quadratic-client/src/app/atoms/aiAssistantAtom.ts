import { CodeCell } from '@/app/gridGL/types/codeCell';
import { AIMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

type AIAssistantState = {
  abortController?: AbortController;
  loading: boolean;
  messages: (UserMessage | AIMessage)[];
  prompt: string;
  context: {
    quadraticDocs: boolean;
    connections: boolean;
    allSheets: boolean;
    currentSheet: boolean;
    visibleData: boolean;
    cursorSelection: boolean;
    codeCell?: CodeCell;
  };
};

export const defaultAIAssistantState: AIAssistantState = {
  abortController: undefined,
  loading: false,
  messages: [],
  prompt: '',
  context: {
    quadraticDocs: true,
    connections: false,
    allSheets: false,
    currentSheet: false,
    visibleData: false,
    cursorSelection: false,
    codeCell: undefined,
  },
};

export const aiAssistantAtom = atom<AIAssistantState>({
  key: 'aiAssistantAtom',
  default: defaultAIAssistantState,
});

const createSelector = <T extends keyof AIAssistantState>(key: T) =>
  selector<AIAssistantState[T]>({
    key: `aiAssistant${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(aiAssistantAtom)[key],
    set: ({ set }, newValue) =>
      set(aiAssistantAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });

export const aiAssistantAbortControllerAtom = createSelector('abortController');
export const aiAssistantLoadingAtom = createSelector('loading');
export const aiAssistantMessagesAtom = createSelector('messages');
export const aiAssistantPromptAtom = createSelector('prompt');
export const aiAssistantContextAtom = createSelector('context');

export const aiAssistantMessagesCountAtom = selector<number>({
  key: 'aiAssistantMessagesCountAtom',
  get: ({ get }) => get(aiAssistantMessagesAtom).length,
});
