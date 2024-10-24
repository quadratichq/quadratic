import { focusGrid } from '@/app/helpers/focusGrid';
import { AIMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

export interface AIAnalystState {
  showAIAnalyst: boolean;
  showInternalContext: boolean;
  abortController?: AbortController;
  loading: boolean;
  messages: (UserMessage | AIMessage)[];
}

export const defaultAIAnalystState: AIAnalystState = {
  showAIAnalyst: true,
  showInternalContext: false,
  abortController: undefined,
  loading: false,
  messages: [],
};

export const aiAnalystAtom = atom<AIAnalystState>({
  key: 'aiAnalystAtom',
  default: defaultAIAnalystState,
  effects: [
    ({ onSet }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) {
          return;
        }

        if (oldValue.showAIAnalyst && !newValue.showAIAnalyst) {
          focusGrid();
        }
      });
    },
  ],
});

const createSelector = <T extends keyof AIAnalystState>(key: T) =>
  selector<AIAnalystState[T]>({
    key: `aiAnalyst${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(aiAnalystAtom)[key],
    set: ({ set }, newValue) =>
      set(aiAnalystAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });
export const showAIAnalystAtom = createSelector('showAIAnalyst');
export const aiAnalystShowInternalContextAtom = createSelector('showInternalContext');
export const aiAnalystAbortControllerAtom = createSelector('abortController');
export const aiAnalystLoadingAtom = createSelector('loading');
export const aiAnalystMessagesAtom = createSelector('messages');

export const aiAnalystMessagesCountAtom = selector<number>({
  key: 'aiAnalystMessagesCountAtom',
  get: ({ get }) => get(aiAnalystMessagesAtom).filter((message) => message.contextType === 'userPrompt').length,
});
