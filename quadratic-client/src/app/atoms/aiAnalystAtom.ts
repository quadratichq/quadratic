import { focusGrid } from '@/app/helpers/focusGrid';
import { AIMessage, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
import { v4 } from 'uuid';

export interface Chat {
  id: string;
  name: string;
  lastUpdated: number;
  messages: (UserMessage | AIMessage)[];
}

export interface AIAnalystState {
  showAIAnalyst: boolean;
  showChatHistory: boolean;
  showInternalContext: boolean;
  abortController?: AbortController;
  loading: boolean;
  chats: Chat[];
  currentChat: Chat;
}

export const defaultAIAnalystState: AIAnalystState = {
  showAIAnalyst: true,
  showChatHistory: false,
  showInternalContext: false,
  abortController: undefined,
  loading: false,
  chats: [
    // TODO(ayush): remove dummy chats
    {
      id: v4(),
      name: 'Dummy chat 1',
      lastUpdated: Date.now(),
      messages: [],
    },
    {
      id: v4(),
      name: 'Dummy chat 2',
      lastUpdated: new Date(new Date().getFullYear(), new Date().getMonth(), 0).getTime(),
      messages: [],
    },
    {
      id: v4(),
      name: 'Dummy chat 3',
      lastUpdated: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).getTime(),
      messages: [],
    },
  ],
  currentChat: {
    id: '',
    name: '',
    lastUpdated: Date.now(),
    messages: [],
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
  ],
});

const createSelector = <T extends keyof AIAnalystState>(key: T) =>
  selector<AIAnalystState[T]>({
    key: `aiAnalyst${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(aiAnalystAtom)[key],
    set: ({ set }, newValue) => {
      set(aiAnalystAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      }));
    },
  });
export const showAIAnalystAtom = createSelector('showAIAnalyst');
export const aiAnalystShowChatHistoryAtom = createSelector('showChatHistory');
export const aiAnalystShowInternalContextAtom = createSelector('showInternalContext');
export const aiAnalystAbortControllerAtom = createSelector('abortController');

export const aiAnalystLoadingAtom = selector<boolean>({
  key: 'aiAnalystLoadingAtom',
  get: ({ get }) => get(aiAnalystAtom).loading,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      let chats: Chat[] = prev.chats;
      if (prev.loading && !newValue) {
        if (!prev.currentChat.name) {
          console.log('TODO(ayush): update name from AI');
        }

        chats = prev.chats.map((chat) => (chat.id === prev.currentChat.id ? prev.currentChat : chat));
        console.log('TODO(ayush): sync current chat');
      }

      return {
        ...prev,
        chats,
        loading: newValue,
      };
    });
  },
});

export const aiAnalystChatsAtom = selector<Chat[]>({
  key: 'aiAnalystChatsAtom',
  get: ({ get }) => get(aiAnalystAtom).chats,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      const deletedChatIds = prev.chats
        .filter((chat) => !newValue.some((newChat) => newChat.id === chat.id))
        .map((chat) => chat.id);
      if (deletedChatIds.length > 0) {
        console.log('TODO(ayush): delete chats', deletedChatIds);
      }

      return {
        ...prev,
        chats: newValue,
      };
    });
  },
});

export const aiAnalystChatsCountAtom = selector<number>({
  key: 'aiAnalystChatsCountAtom',
  get: ({ get }) => get(aiAnalystChatsAtom).length,
});

export const aiAnalystCurrentChatAtom = selector<Chat>({
  key: 'aiAnalystCurrentChatAtom',
  get: ({ get }) => get(aiAnalystAtom).currentChat,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      if (!!newValue.id && newValue.messages.length === 0) {
        console.log('TODO(ayush): load chat messages');
      }

      return {
        ...prev,
        showChatHistory: false,
        currentChat: newValue,
      };
    });
  },
});

export const aiAnalystCurrentChatMessagesAtom = selector<(UserMessage | AIMessage)[]>({
  key: 'aiAnalystCurrentChatMessagesAtom',
  get: ({ get }) => get(aiAnalystCurrentChatAtom).messages,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      let id = prev.currentChat.id;
      if (!id) {
        id = v4();
      }

      const currentChat: Chat = {
        id,
        name: prev.currentChat.name,
        lastUpdated: Date.now(),
        messages: newValue,
      };

      const addNewChat = newValue.length > 0 && !prev.chats.some((chat) => chat.id === id);

      return {
        ...prev,
        chats: addNewChat ? [...prev.chats, currentChat] : prev.chats,
        currentChat,
      };
    });
  },
});

export const aiAnalystCurrentChatMessagesCountAtom = selector<number>({
  key: 'aiAnalystCurrentChatMessagesCountAtom',
  get: ({ get }) =>
    get(aiAnalystCurrentChatAtom).messages.filter((message) => message.contextType === 'userPrompt').length,
});
