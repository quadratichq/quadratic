import type { CategorizedEmptyChatPromptSuggestions } from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';
import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { gridSettingsAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import {
  isAIPromptMessage,
  isToolResultMessage,
  isUserPromptMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { Chat, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';

export interface EmptyChatSuggestionsState {
  suggestions: CategorizedEmptyChatPromptSuggestions | undefined;
  contextHash: string | undefined;
  loading: boolean;
  abortController: AbortController | undefined;
}

export interface AIAnalystState {
  showAIAnalyst: boolean;
  activeSchemaConnectionUuid: string | undefined;
  showChatHistory: boolean;
  abortController?: AbortController;
  loading: boolean;
  chats: Chat[];
  currentChat: Chat;
  promptSuggestions: {
    abortController: AbortController | undefined;
    suggestions: z.infer<(typeof AIToolsArgsSchema)[AITool.UserPromptSuggestions]>['prompt_suggestions'];
  };
  emptyChatSuggestions: EmptyChatSuggestionsState;
  pdfImport: {
    abortController: AbortController | undefined;
    loading: boolean;
  };
  webSearch: {
    abortController: AbortController | undefined;
    loading: boolean;
  };
  importFilesToGrid: {
    loading: boolean;
  };
  waitingOnMessageIndex?: number;
  failingSqlConnections: { uuids: string[]; lastResetTimestamp: number };
}

export const defaultAIAnalystState: AIAnalystState = {
  showAIAnalyst: false,
  activeSchemaConnectionUuid: undefined,
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
  emptyChatSuggestions: {
    suggestions: undefined,
    contextHash: undefined,
    loading: false,
    abortController: undefined,
  },
  pdfImport: {
    abortController: undefined,
    loading: false,
  },
  webSearch: {
    abortController: undefined,
    loading: false,
  },
  importFilesToGrid: {
    loading: false,
  },
  waitingOnMessageIndex: undefined,
  failingSqlConnections: { uuids: [], lastResetTimestamp: 0 },
};

export let aiAnalystInitialized = false;

export const aiAnalystAtom = atom<AIAnalystState>({
  key: 'aiAnalystAtom',
  default: defaultAIAnalystState,
  effects: [
    ({ setSelf, trigger, getLoadable }) => {
      if (trigger === 'get') {
        // Ensure gridSettingsAtom is initialized from localStorage before reading the value
        // This prevents the race condition where we read the default value (true) instead of
        // the saved localStorage value
        const gridSettings = getLoadable(gridSettingsAtom).getValue();
        const showAIAnalyst = gridSettings.showAIAnalystOnStartup;
        setSelf({
          ...defaultAIAnalystState,
          showAIAnalyst,
        });

        const user = getLoadable(editorInteractionStateUserAtom).getValue();
        const fileUuid = getLoadable(editorInteractionStateFileUuidAtom).getValue();
        if (!!user?.email && fileUuid) {
          aiAnalystOfflineChats
            .init(user.email, fileUuid)
            .then(() =>
              aiAnalystOfflineChats.loadChats().then((chats) => {
                setSelf({
                  ...defaultAIAnalystState,
                  showAIAnalyst,
                  chats,
                });
              })
            )
            .then(() => {
              aiAnalystInitialized = true;
              events.emit('aiAnalystInitialized');
            })
            .catch((error) => {
              console.error('[AIAnalystOfflineChats]: ', error);
            })
            .finally(() => {
              aiAnalystInitialized = true;
              events.emit('aiAnalystInitialized');
            });
        } else {
          aiAnalystInitialized = true;
          events.emit('aiAnalystInitialized');
        }
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
export const aiAnalystShowChatHistoryAtom = createSelector('showChatHistory');
export const aiAnalystAbortControllerAtom = createSelector('abortController');
export const aiAnalystActiveSchemaConnectionUuidAtom = createSelector('activeSchemaConnectionUuid');

export const showAIAnalystAtom = selector<boolean>({
  key: 'showAIAnalystAtom',
  get: ({ get }) => {
    // If agent mode is enabled, always show AI Analyst
    const agentMode = get(agentModeAtom);
    if (agentMode) return true;
    return get(aiAnalystAtom).showAIAnalyst;
  },
  set: ({ set, get }, newValue) => {
    const currentState = get(aiAnalystAtom);
    const isShowing = currentState.showAIAnalyst;
    const willShow = newValue instanceof DefaultValue ? currentState.showAIAnalyst : newValue;

    set(aiAnalystAtom, (prev) => ({
      ...prev,
      showAIAnalyst: newValue instanceof DefaultValue ? prev.showAIAnalyst : newValue,
      // Reset when hiding the AI Analyst
      activeSchemaConnectionUuid: isShowing && !willShow ? undefined : prev.activeSchemaConnectionUuid,
    }));
  },
});

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

      return { ...prev, loading: newValue };
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

      // Update currentChat if it was deleted or if it exists in the new chats array (e.g., renamed)
      let updatedCurrentChat = prev.currentChat;
      if (deletedChatIds.includes(prev.currentChat.id)) {
        updatedCurrentChat = {
          id: '',
          name: '',
          lastUpdated: Date.now(),
          messages: [],
        };
      } else if (prev.currentChat.id) {
        // If currentChat exists, check if it was updated in the new chats array
        const updatedChat = newValue.find((chat) => chat.id === prev.currentChat.id);
        if (updatedChat) {
          updatedCurrentChat = updatedChat;
        }
      }

      return {
        ...prev,
        showChatHistory: newValue.length > 0 ? prev.showChatHistory : false,
        chats: newValue,
        currentChat: updatedCurrentChat,
        promptSuggestions: { abortController: undefined, suggestions: [] },
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

      let suggestions: z.infer<(typeof AIToolsArgsSchema)[AITool.UserPromptSuggestions]>['prompt_suggestions'] = [];

      const lastMessage = newValue.messages.at(-1);
      const secondToLastMessage = newValue.messages.at(-2);
      const lastAIMessage = !!lastMessage && isToolResultMessage(lastMessage) ? secondToLastMessage : lastMessage;
      if (!!lastAIMessage && isAIPromptMessage(lastAIMessage)) {
        const promptSuggestions = lastAIMessage.toolCalls
          .filter(
            (toolCall) =>
              toolCall.name === AITool.UserPromptSuggestions && toolCall.arguments.length > 0 && !toolCall.loading
          )
          .at(-1);
        if (promptSuggestions) {
          try {
            const argsObject = JSON.parse(promptSuggestions.arguments);
            suggestions = aiToolsSpec[AITool.UserPromptSuggestions].responseSchema.parse(argsObject).prompt_suggestions;
          } catch {
            suggestions = [];
          }
        }
      }

      return {
        ...prev,
        showChatHistory: false,
        chats,
        currentChat: newValue,
        promptSuggestions: { abortController: undefined, suggestions },
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

      return { ...prev, chats, currentChat };
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

      prev.promptSuggestions.abortController?.abort();

      // update current chat
      const currentChat: Chat = {
        id: !!prev.currentChat.id ? prev.currentChat.id : v4(),
        name: prev.currentChat.name,
        lastUpdated: Date.now(),
        messages: newValue,
      };

      // update chats
      const chats = [...prev.chats.filter((chat) => chat.id !== currentChat.id), currentChat];

      return { ...prev, chats, currentChat };
    });
  },
});

export const aiAnalystCurrentChatMessagesCountAtom = selector<number>({
  key: 'aiAnalystCurrentChatMessagesCountAtom',
  get: ({ get }) => get(aiAnalystCurrentChatAtom).messages.length,
});

export const aiAnalystCurrentChatUserMessagesCountAtom = selector<number>({
  key: 'aiAnalystCurrentChatUserMessagesCountAtom',
  get: ({ get }) => get(aiAnalystCurrentChatAtom).messages.filter((message) => isUserPromptMessage(message)).length,
});

export const aiAnalystPromptSuggestionsAtom = createSelector('promptSuggestions');
export const aiAnalystPromptSuggestionsCountAtom = selector<number>({
  key: 'aiAnalystPromptSuggestionsCountAtom',
  get: ({ get }) => get(aiAnalystPromptSuggestionsAtom).suggestions.length,
});
export const aiAnalystPromptSuggestionsLoadingAtom = selector<boolean>({
  key: 'aiAnalystPromptSuggestionsLoadingAtom',
  get: ({ get }) => get(aiAnalystPromptSuggestionsAtom).abortController !== undefined,
});

export const aiAnalystPDFImportAtom = createSelector('pdfImport');
export const aiAnalystPDFImportLoadingAtom = selector<boolean>({
  key: 'aiAnalystPDFImportLoadingAtom',
  get: ({ get }) => get(aiAnalystPDFImportAtom).loading,
});

export const aiAnalystWebSearchAtom = createSelector('webSearch');
export const aiAnalystWebSearchLoadingAtom = selector<boolean>({
  key: 'aiAnalystWebSearchLoadingAtom',
  get: ({ get }) => get(aiAnalystWebSearchAtom).loading,
});

export const aiAnalystImportFilesToGridAtom = createSelector('importFilesToGrid');
export const aiAnalystImportFilesToGridLoadingAtom = selector<boolean>({
  key: 'aiAnalystImportFilesToGridLoadingAtom',
  get: ({ get }) => get(aiAnalystImportFilesToGridAtom).loading,
});

export const aiAnalystWaitingOnMessageIndexAtom = selector<number | undefined>({
  key: 'aiAnalystWaitingOnMessageIndexAtom',
  get: ({ get }) => get(aiAnalystAtom).waitingOnMessageIndex,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      return { ...prev, waitingOnMessageIndex: newValue };
    });
  },
});

export const aiAnalystFailingSqlConnectionsAtom = selector<{ uuids: string[]; lastResetTimestamp: number }>({
  key: 'aiAnalystFailingSqlConnectionsAtom',
  get: ({ get }) => get(aiAnalystAtom).failingSqlConnections,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      return { ...prev, failingSqlConnections: newValue };
    });
  },
});

export const aiAnalystEmptyChatSuggestionsAtom = selector<EmptyChatSuggestionsState>({
  key: 'aiAnalystEmptyChatSuggestionsAtom',
  get: ({ get }) => get(aiAnalystAtom).emptyChatSuggestions,
  set: ({ set }, newValue) => {
    set(aiAnalystAtom, (prev) => {
      if (newValue instanceof DefaultValue) {
        return prev;
      }

      // Abort any in-flight request when setting new state
      if (
        prev.emptyChatSuggestions.abortController &&
        newValue.abortController !== prev.emptyChatSuggestions.abortController
      ) {
        prev.emptyChatSuggestions.abortController.abort();
      }

      return { ...prev, emptyChatSuggestions: newValue };
    });
  },
});

export const aiAnalystEmptyChatSuggestionsLoadingAtom = selector<boolean>({
  key: 'aiAnalystEmptyChatSuggestionsLoadingAtom',
  get: ({ get }) => get(aiAnalystEmptyChatSuggestionsAtom).loading,
});
