import { events } from '@/app/events/events';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { focusGrid } from '@/app/helpers/focusGrid';
import { SheetRect } from '@/app/quadratic-core-types';
import { AIMessage, ContextType, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
export interface AIAnalystState {
  showAIAnalyst: boolean;
  showInternalContext: boolean;
  abortController?: AbortController;
  loading: boolean;
  messages: (UserMessage | AIMessage)[];
  context: {
    [key in Exclude<ContextType, 'selection' | 'codeCell' | 'userPrompt'>]: boolean;
  } & { selection?: SheetRect; codeCell?: CodeCell };
}

export const defaultAIAnalystState: AIAnalystState = {
  showAIAnalyst: true,
  showInternalContext: false,
  abortController: undefined,
  loading: false,
  messages: [],
  context: {
    quadraticDocs: true,
    connections: false,
    allSheets: false,
    currentSheet: true,
    visibleData: true,
    toolUse: true,
    selection: undefined,
    codeCell: undefined,
  },
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
export const aiAnalystContextAtom = createSelector('context');

export const aiAnalystMessagesCountAtom = selector<number>({
  key: 'aiAnalystMessagesCountAtom',
  get: ({ get }) => get(aiAnalystMessagesAtom).filter((message) => !message.internalContext).length,
});
