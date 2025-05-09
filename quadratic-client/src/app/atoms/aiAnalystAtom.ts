import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { showAIAnalystOnStartupAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { AITool, AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { Chat, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';

const CLEAN_UP_MESSAGE =
  'NOTE: the results from this tool call have been removed from the context. If you need to use them, you MUST call the tool again.';

export interface AIAnalystState {
  showAIAnalyst: boolean;
  showChatHistory: boolean;
  abortController?: AbortController;
  loading: boolean;
  chats: Chat[];
  currentChat: Chat;
  promptSuggestions: {
    abortController: AbortController | undefined;
    suggestions: z.infer<(typeof AIToolsArgsSchema)[AITool.UserPromptSuggestions]>['prompt_suggestions'];
  };
  pdfImport: {
    abortController: AbortController | undefined;
    loading: boolean;
  };
  waitingOnMessageIndex?: number;
  delaySeconds: number;
}

export const defaultAIAnalystState: AIAnalystState = {
  showAIAnalyst: false,
  showChatHistory: false,
  abortController: undefined,
  loading: false,
  chats: [],
  currentChat: {
    id: '',
    name: '',
    lastUpdated: Date.now(),
    messages: [],
  },
  promptSuggestions: {
    abortController: undefined,
    suggestions: [],
  },
  pdfImport: {
    abortController: undefined,
    loading: false,
  },
  waitingOnMessageIndex: undefined,
  delaySeconds: 0,
};

export const aiAnalystAtom = atom<AIAnalystState>({
  key: 'aiAnalystAtom',
  default: defaultAIAnalystState,
  effects: [
    async ({ getPromise, setSelf, trigger }) => {
      if (trigger === 'get') {
        const showAIAnalyst = await getPromise(showAIAnalystOnStartupAtom);
        setSelf({
          ...defaultAIAnalystState,
          showAIAnalyst,
        });

        const user = await getPromise(editorInteractionStateUserAtom);
        const fileUuid = await getPromise(editorInteractionStateFileUuidAtom);
        if (!!user?.email && fileUuid) {
          try {
            await aiAnalystOfflineChats.init(user.email, fileUuid);
            const chats = await aiAnalystOfflineChats.loadChats();
            setSelf({
              ...defaultAIAnalystState,
              showAIAnalyst,
              chats,
            });
          } catch (error) {
            console.error('[AIAnalystOfflineChats]: ', error);
          }
        }
        events.emit('aiAnalystInitialized');
      }
    },
    ({ onSet }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) {
          return;
        }

        if (oldValue.showAIAnalyst && !newValue.showAIAnalyst) {
          oldValue.abortController?.abort();
          focusGrid();
        }

        if (!oldValue.showChatHistory && newValue.showChatHistory) {
          oldValue.abortController?.abort();
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
export const aiAnalystAbortControllerAtom = createSelector('abortController');

export const aiAnalystLoadingAtom = selector<boolean>({
  key: 'aiAnalystLoadingAtom',
  get: ({ get }) => get(aiAnalystAtom).loading,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      if (prev.loading && !newValue) {
        // save chat after new message is finished loading
        const currentChat = prev.currentChat;
        if (currentChat.id) {
          aiAnalystOfflineChats.saveChats([currentChat]).catch((error) => {
            console.error('[AIAnalystOfflineChats]: ', error);
          });
        }
      }

      return {
        ...prev,
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

      prev.promptSuggestions.abortController?.abort();

      // find deleted chats that are not in the new value
      const deletedChatIds = prev.chats
        .filter((chat) => !newValue.some((newChat) => newChat.id === chat.id))
        .map((chat) => chat.id);
      // delete offline chats
      if (deletedChatIds.length > 0) {
        aiAnalystOfflineChats.deleteChats(deletedChatIds).catch((error) => {
          console.error('[AIAnalystOfflineChats]: ', error);
        });
      }

      // find changed chats
      const changedChats = newValue.reduce<Chat[]>((acc, chat) => {
        const prevChat = prev.chats.find((prevChat) => prevChat.id === chat.id);
        if (!prevChat) {
          acc.push(chat);
        } else if (
          prevChat.name !== chat.name ||
          prevChat.lastUpdated !== chat.lastUpdated ||
          prevChat.messages !== chat.messages
        ) {
          acc.push(chat);
        }

        return acc;
      }, []);
      // save changed chats
      if (changedChats.length > 0) {
        aiAnalystOfflineChats.saveChats(changedChats).catch((error) => {
          console.error('[AIAnalystOfflineChats]: ', error);
        });
      }

      return {
        ...prev,
        showChatHistory: newValue.length > 0 ? prev.showChatHistory : false,
        chats: newValue,
        currentChat: deletedChatIds.includes(prev.currentChat.id)
          ? {
              id: '',
              name: '',
              lastUpdated: Date.now(),
              messages: [],
            }
          : prev.currentChat,
        promptSuggestions: {
          abortController: undefined,
          suggestions: [],
        },
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

      prev.promptSuggestions.abortController?.abort();

      let chats = prev.chats;
      if (newValue.id) {
        chats = [...chats.filter((chat) => chat.id !== newValue.id), newValue];
      }

      return {
        ...prev,
        showChatHistory: false,
        chats,
        currentChat: newValue,
        promptSuggestions: {
          abortController: undefined,
          suggestions: [],
        },
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

      // update current chat
      const currentChat: Chat = {
        ...prev.currentChat,
        id: !!prev.currentChat.id ? prev.currentChat.id : v4(),
        name: newValue,
      };

      // update chats
      const chats = [...prev.chats.filter((chat) => chat.id !== currentChat.id), currentChat];

      // save chat with new name
      aiAnalystOfflineChats.saveChats([currentChat]).catch((error) => {
        console.error('[AIAnalystOfflineChats]: ', error);
      });

      return {
        ...prev,
        chats,
        currentChat,
      };
    });
  },
});

// Cleans up old get_ tool messages to avoid clogging the context.
const cleanUpGetToolCalls = (messages: ChatMessage[]): ChatMessage[] => {
  const foundGetCellData: ChatMessage[] = [];
  messages.forEach((message) => {
    if (message.contextType === 'toolResult' && message.content.length === 1) {
      const content = message.content[0];
      if (content.fn === 'get_cell_data' && content.text !== CLEAN_UP_MESSAGE) {
        foundGetCellData.push(message);
      }
    }
  });

  // If we have multiple get_cell_data messages, keep only the most recent one
  if (foundGetCellData.length > 1) {
    const messagesToClean = foundGetCellData.slice(0, -1); // All but last message
    return messages.map((message) => {
      if (messagesToClean.includes(message)) {
        // Only modify tool result messages
        if (
          message.contextType === 'toolResult' &&
          message.content[0] &&
          'id' in message.content[0] &&
          'fn' in message.content[0]
        ) {
          return {
            ...message,
            content: [
              {
                id: message.content[0].id,
                fn: message.content[0].fn,
                text: CLEAN_UP_MESSAGE,
              },
            ],
          };
        }
      }
      return message;
    });
  }
  return messages;
};

export const aiAnalystCurrentChatMessagesAtom = selector<ChatMessage[]>({
  key: 'aiAnalystCurrentChatMessagesAtom',
  get: ({ get }) => get(aiAnalystCurrentChatAtom).messages,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      prev.promptSuggestions.abortController?.abort();

      // update current chat
      const currentChat: Chat = {
        id: !!prev.currentChat.id ? prev.currentChat.id : v4(),
        name: prev.currentChat.name,
        lastUpdated: Date.now(),
        messages: cleanUpGetToolCalls(newValue),
      };

      // update chats
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
  get: ({ get }) => get(aiAnalystCurrentChatAtom).messages.length,
});

export const aiAnalystCurrentChatUserMessagesCountAtom = selector<number>({
  key: 'aiAnalystCurrentChatUserMessagesCountAtom',
  get: ({ get }) =>
    get(aiAnalystCurrentChatAtom).messages.filter(
      (message) => message.role === 'user' && message.contextType === 'userPrompt'
    ).length,
});

export const aiAnalystPromptSuggestionsAtom = createSelector('promptSuggestions');
export const aiAnalystPromptSuggestionsCountAtom = selector<number>({
  key: 'aiAnalystPromptSuggestionsCountAtom',
  get: ({ get }) => get(aiAnalystPromptSuggestionsAtom).suggestions.length,
});

export const aiAnalystPDFImportAtom = createSelector('pdfImport');
export const aiAnalystPDFImportLoadingAtom = selector<boolean>({
  key: 'aiAnalystPDFImportLoadingAtom',
  get: ({ get }) => get(aiAnalystPDFImportAtom).loading,
});

export const aiAnalystWaitingOnMessageIndexAtom = selector<number | undefined>({
  key: 'aiAnalystWaitingOnMessageIndexAtom',
  get: ({ get }) => get(aiAnalystAtom).waitingOnMessageIndex,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      return {
        ...prev,
        waitingOnMessageIndex: newValue,
      };
    });
  },
});

export const aiAnalystDelaySecondsAtom = selector<number>({
  key: 'aiAnalystDelaySecondsAtom',
  get: ({ get }) => get(aiAnalystAtom).delaySeconds,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      return {
        ...prev,
        delaySeconds: newValue,
      };
    });
  },
});
