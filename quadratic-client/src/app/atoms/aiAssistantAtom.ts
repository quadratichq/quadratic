import { CodeCell } from '@/app/gridGL/types/codeCell';
import { focusGrid } from '@/app/helpers/focusGrid';
import { Selection } from '@/app/quadratic-core-types';
import { AIMessage, ContextType, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
export interface AIAssistantState {
  showAIAssistant: boolean;
  abortController?: AbortController;
  loading: boolean;
  messages: (UserMessage | AIMessage)[];
  prompt: string;
  context: {
    [key in Exclude<ContextType, 'cursorSelection' | 'codeCell' | 'userPrompt'>]: boolean;
  } & { cursorSelection?: Selection; codeCell?: CodeCell };
}

export const defaultAIAssistantState: AIAssistantState = {
  showAIAssistant: true,
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
    cursorSelection: undefined,
    codeCell: undefined,
  },
};

export const aiAssistantAtom = atom<AIAssistantState>({
  key: 'aiAssistantAtom',
  default: defaultAIAssistantState,
});

export const showAIAssistantAtom = selector<AIAssistantState['showAIAssistant']>({
  key: 'showAIAssistantAtom',
  get: ({ get }) => get(aiAssistantAtom)['showAIAssistant'],
  set: ({ set }, newValue) =>
    set(aiAssistantAtom, (prev) => {
      if (prev.showAIAssistant && !newValue) {
        focusGrid();
      }
      return {
        ...prev,
        showAIAssistant: newValue instanceof DefaultValue ? prev['showAIAssistant'] : newValue,
      };
    }),
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
