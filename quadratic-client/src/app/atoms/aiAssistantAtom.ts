import { Coordinate } from '@/app/gridGL/types/size';
import { AIMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

export enum ContextType {
  CodeCell = 'codeCell',
  Selection = 'selection',
  Sheet = 'sheet',
}

type CodeCellContext = {
  type: ContextType;
  sheetId: string;
  pos: Coordinate;
};

type AIAssistantState = {
  abortController?: AbortController;
  loading: boolean;
  messages: (UserMessage | AIMessage)[];
  prompt: string;
  context?: CodeCellContext;
};

const defaultAIAssistantState: AIAssistantState = {
  abortController: undefined,
  loading: false,
  messages: [],
  prompt: '',
  context: undefined,
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
