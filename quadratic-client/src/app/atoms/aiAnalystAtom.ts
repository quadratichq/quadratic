import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalyst';
import { editorInteractionStateUserAtom, editorInteractionStateUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { ChatMessage, Context } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
import { v4 } from 'uuid';

export const defaultAIAnalystContext: Context = {
  quadraticDocs: true,
  connections: false,
  allSheets: false,
  currentSheet: true,
  visibleData: true,
  toolUse: true,
  selection: [],
};

export interface Chat {
  id: string;
  name: string;
  lastUpdated: number;
  messages: ChatMessage[];
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
  chats: [],
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
    async ({ getPromise, setSelf, trigger }) => {
      if (trigger === 'get') {
        const user = await getPromise(editorInteractionStateUserAtom);
        const uuid = await getPromise(editorInteractionStateUuidAtom);
        if (!!user?.email && uuid) {
          try {
            await aiAnalystOfflineChats.init(user.email, uuid);
            const chats = await aiAnalystOfflineChats.loadChats();
            setSelf({
              ...defaultAIAnalystState,
              chats,
            });
          } catch (error) {
            console.error('[AIAnalystOfflineChats]: ', error);
          }
        }
      }
    },
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
        const currentChat = prev.currentChat;
        if (currentChat.id) {
          aiAnalystOfflineChats.saveChats([currentChat]).catch((error) => {
            console.error('[AIAnalystOfflineChats]: ', error);
          });
        }

        if (!prev.currentChat.name) {
          console.log('TODO(ayush): update name from AI');
        }
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
        aiAnalystOfflineChats.deleteChats(deletedChatIds).catch((error) => {
          console.error('[AIAnalystOfflineChats]: ', error);
        });
      }

      return {
        ...prev,
        chats: newValue,
        currentChat: deletedChatIds.includes(prev.currentChat.id)
          ? {
              id: '',
              name: '',
              lastUpdated: Date.now(),
              messages: [],
            }
          : prev.currentChat,
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

      let chats = prev.chats;
      if (newValue.id) {
        chats = [...chats.filter((chat) => chat.id !== newValue.id), newValue];
      }

      return {
        ...prev,
        showChatHistory: false,
        chats,
        currentChat: newValue,
      };
    });
  },
});

export const aiAnalystCurrentChatNameAtom = selector<string>({
  key: 'aiAnalystCurrentChatNameAtom',
  get: ({ get }) => get(aiAnalystCurrentChatAtom).name,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      const currentChat: Chat = {
        ...prev.currentChat,
        id: !!prev.currentChat.id ? prev.currentChat.id : v4(),
        name: newValue,
      };

      aiAnalystOfflineChats.saveChats([currentChat]).catch((error) => {
        console.error('[AIAnalystOfflineChats]: ', error);
      });

      const chats = [...prev.chats.filter((chat) => chat.id !== currentChat.id), currentChat];

      return {
        ...prev,
        chats,
        currentChat,
      };
    });
  },
});

export const aiAnalystCurrentChatMessagesAtom = selector<ChatMessage[]>({
  key: 'aiAnalystCurrentChatMessagesAtom',
  get: ({ get }) => get(aiAnalystCurrentChatAtom).messages,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      const currentChat: Chat = {
        id: prev.currentChat.id ? prev.currentChat.id : v4(),
        name: prev.currentChat.name,
        lastUpdated: Date.now(),
        messages: newValue,
      };

      const chats = [...prev.chats.filter((chat) => chat.id !== currentChat.id), currentChat];

      return {
        ...prev,
        chats,
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
