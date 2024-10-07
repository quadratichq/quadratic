import { events } from '@/app/events/events';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { focusGrid } from '@/app/helpers/focusGrid';
import { SheetRect } from '@/app/quadratic-core-types';
import { AIMessage, ContextType, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
export interface AIAssistantState {
  showAIAssistant: boolean;
  showInternalContext: boolean;
  abortController?: AbortController;
  loading: boolean;
  messages: (UserMessage | AIMessage)[];
  prompt: string;
  context: {
    [key in Exclude<ContextType, 'selection' | 'codeCell' | 'userPrompt'>]: boolean;
  } & { selection?: SheetRect; codeCell?: CodeCell };
}

export const defaultAIAssistantState: AIAssistantState = {
  showAIAssistant: true,
  showInternalContext: false,
  abortController: undefined,
  loading: false,
  messages: [],
  prompt: '',
  context: {
    quadraticDocs: true,
    connections: false,
    allSheets: false,
    currentSheet: false,
    visibleData: true,
    selection: undefined,
    codeCell: undefined,
  },
};

export const aiAssistantAtom = atom<AIAssistantState>({
  key: 'aiAssistantAtom',
  default: defaultAIAssistantState,
  effects: [
    ({ onSet }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) {
          return;
        }

        if (oldValue.showAIAssistant && !newValue.showAIAssistant) {
          focusGrid();
        }
      });
    },
    ({ setSelf }) => {
      const updateCodeCell = (codeCell?: CodeCell) => {
        setSelf((prev) => {
          if (prev instanceof DefaultValue) {
            return prev;
          }

          return { ...prev, context: { ...prev.context, codeCell } };
        });
      };
      events.on('codeEditorCodeCell', updateCodeCell);
      return () => {
        events.off('codeEditorCodeCell', updateCodeCell);
      };
    },
  ],
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
export const showAIAssistantAtom = createSelector('showAIAssistant');
export const aiAssistantShowInternalContextAtom = createSelector('showInternalContext');
export const aiAssistantAbortControllerAtom = createSelector('abortController');
export const aiAssistantLoadingAtom = createSelector('loading');
export const aiAssistantMessagesAtom = createSelector('messages');
export const aiAssistantPromptAtom = createSelector('prompt');
export const aiAssistantContextAtom = createSelector('context');

export const aiAssistantMessagesCountAtom = selector<number>({
  key: 'aiAssistantMessagesCountAtom',
  get: ({ get }) => get(aiAssistantMessagesAtom).length,
});
