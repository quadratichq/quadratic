import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import { atom, getDefaultStore } from 'jotai';
import {
  isAIPromptMessage,
  isToolResultMessage,
  isUserPromptMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { Chat, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import type { z } from 'zod';

// Get the default Jotai store for vanilla JS access
export const aiStore = getDefaultStore();

// Type for prompt suggestions
type PromptSuggestions = z.infer<(typeof AIToolsArgsSchema)[AITool.UserPromptSuggestions]>['prompt_suggestions'];

// AIAnalystState interface for PixiAppSettings compatibility
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
    suggestions: PromptSuggestions;
  };
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

// Default values
const defaultChat: Chat = {
  id: '',
  name: '',
  lastUpdated: Date.now(),
  messages: [],
};

export const defaultAIAnalystState: AIAnalystState = {
  showAIAnalyst: false,
  activeSchemaConnectionUuid: undefined,
  showChatHistory: false,
  abortController: undefined,
  loading: false,
  chats: [],
  currentChat: defaultChat,
  promptSuggestions: {
    abortController: undefined,
    suggestions: [],
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

// ============================================================================
// Base Atoms (primitives)
// ============================================================================

export const showAIAnalystAtom = atom(false);
export const showChatHistoryAtom = atom(false);
export const loadingAtom = atom(false);
export const abortControllerAtom = atom<AbortController | undefined>(undefined);
export const activeSchemaConnectionUuidAtom = atom<string | undefined>(undefined);
export const waitingOnMessageIndexAtom = atom<number | undefined>(undefined);

export const failingSqlConnectionsAtom = atom<{ uuids: string[]; lastResetTimestamp: number }>({
  uuids: [],
  lastResetTimestamp: 0,
});

// ============================================================================
// Chat State Atoms
// ============================================================================

export const chatsAtom = atom<Chat[]>([]);

// Current chat - base atom
const currentChatBaseAtom = atom<Chat>(defaultChat);

// Prompt suggestions state
export const promptSuggestionsAtom = atom<{
  abortController: AbortController | undefined;
  suggestions: PromptSuggestions;
}>({
  abortController: undefined,
  suggestions: [],
});

// PDF import state
export const pdfImportAtom = atom<{
  abortController: AbortController | undefined;
  loading: boolean;
}>({
  abortController: undefined,
  loading: false,
});

// Web search state
export const webSearchAtom = atom<{
  abortController: AbortController | undefined;
  loading: boolean;
}>({
  abortController: undefined,
  loading: false,
});

// Import files to grid state
export const importFilesToGridAtom = atom<{ loading: boolean }>({
  loading: false,
});

// ============================================================================
// Derived Atoms (computed values)
// ============================================================================

// Chats count
export const chatsCountAtom = atom((get) => get(chatsAtom).length);

// Current chat with side effects on set
export const currentChatAtom = atom(
  (get) => get(currentChatBaseAtom),
  (get, set, newValue: Chat) => {
    // Abort any pending prompt suggestions
    const prevSuggestions = get(promptSuggestionsAtom);
    prevSuggestions.abortController?.abort();

    // Update chats list if this chat has an id
    let chats = get(chatsAtom);
    if (newValue.id) {
      chats = [...chats.filter((chat) => chat.id !== newValue.id), newValue];
      set(chatsAtom, chats);
    }

    // Extract prompt suggestions from last AI message
    let suggestions: PromptSuggestions = [];
    const lastMessage = newValue.messages.at(-1);
    const secondToLastMessage = newValue.messages.at(-2);
    const lastAIMessage = !!lastMessage && isToolResultMessage(lastMessage) ? secondToLastMessage : lastMessage;

    if (!!lastAIMessage && isAIPromptMessage(lastAIMessage)) {
      const promptSuggestion = lastAIMessage.toolCalls
        .filter(
          (toolCall) =>
            toolCall.name === AITool.UserPromptSuggestions && toolCall.arguments.length > 0 && !toolCall.loading
        )
        .at(-1);

      if (promptSuggestion) {
        try {
          const argsObject = JSON.parse(promptSuggestion.arguments);
          suggestions = aiToolsSpec[AITool.UserPromptSuggestions].responseSchema.parse(argsObject).prompt_suggestions;
        } catch {
          suggestions = [];
        }
      }
    }

    // Hide chat history and update state
    set(showChatHistoryAtom, false);
    set(currentChatBaseAtom, newValue);
    set(promptSuggestionsAtom, { abortController: undefined, suggestions });
  }
);

// Current chat name with persistence
export const currentChatNameAtom = atom(
  (get) => get(currentChatAtom).name,
  (get, set, newName: string) => {
    const currentChat = get(currentChatBaseAtom);

    // Update current chat
    const updatedChat: Chat = {
      ...currentChat,
      id: currentChat.id || v4(),
      name: newName,
    };

    // Update chats list
    const chats = [...get(chatsAtom).filter((chat) => chat.id !== updatedChat.id), updatedChat];
    set(chatsAtom, chats);
    set(currentChatBaseAtom, updatedChat);

    // Persist to offline storage
    aiAnalystOfflineChats.saveChats([updatedChat]).catch((error) => {
      console.error('[AIAnalystOfflineChats]: ', error);
    });
  }
);

// Current chat messages with auto-update of chat
export const currentChatMessagesAtom = atom(
  (get) => get(currentChatAtom).messages,
  (get, set, newMessages: ChatMessage[]) => {
    // Abort any pending prompt suggestions
    const prevSuggestions = get(promptSuggestionsAtom);
    prevSuggestions.abortController?.abort();

    const currentChat = get(currentChatBaseAtom);

    // Update current chat
    const updatedChat: Chat = {
      id: currentChat.id || v4(),
      name: currentChat.name,
      lastUpdated: Date.now(),
      messages: newMessages,
    };

    // Update chats list
    const chats = [...get(chatsAtom).filter((chat) => chat.id !== updatedChat.id), updatedChat];
    set(chatsAtom, chats);
    set(currentChatBaseAtom, updatedChat);
    set(promptSuggestionsAtom, { abortController: undefined, suggestions: [] });
  }
);

// Current chat messages count
export const currentChatMessagesCountAtom = atom((get) => get(currentChatAtom).messages.length);

// Current chat user messages count
export const currentChatUserMessagesCountAtom = atom(
  (get) => get(currentChatAtom).messages.filter((message) => isUserPromptMessage(message)).length
);

// Prompt suggestions count
export const promptSuggestionsCountAtom = atom((get) => get(promptSuggestionsAtom).suggestions.length);

// Prompt suggestions loading
export const promptSuggestionsLoadingAtom = atom((get) => get(promptSuggestionsAtom).abortController !== undefined);

// PDF import loading
export const pdfImportLoadingAtom = atom((get) => get(pdfImportAtom).loading);

// Web search loading
export const webSearchLoadingAtom = atom((get) => get(webSearchAtom).loading);

// Import files to grid loading
export const importFilesToGridLoadingAtom = atom((get) => get(importFilesToGridAtom).loading);

// ============================================================================
// Chats atom with persistence side effects
// ============================================================================

// Writable chats atom with persistence
export const chatsWithPersistenceAtom = atom(
  (get) => get(chatsAtom),
  (get, set, newChats: Chat[]) => {
    const prevChats = get(chatsAtom);
    const prevSuggestions = get(promptSuggestionsAtom);
    prevSuggestions.abortController?.abort();

    // Find deleted chats
    const deletedChatIds = prevChats
      .filter((chat) => !newChats.some((newChat) => newChat.id === chat.id))
      .map((chat) => chat.id);

    // Delete from offline storage
    if (deletedChatIds.length > 0) {
      aiAnalystOfflineChats.deleteChats(deletedChatIds).catch((error) => {
        console.error('[AIAnalystOfflineChats]: ', error);
      });
    }

    // Find changed chats
    const changedChats = newChats.reduce<Chat[]>((acc, chat) => {
      const prevChat = prevChats.find((p) => p.id === chat.id);
      if (!prevChat) {
        acc.push(chat);
      } else if (prevChat.name !== chat.name || prevChat.lastUpdated !== chat.lastUpdated) {
        acc.push(chat);
      }
      return acc;
    }, []);

    // Save changed chats
    if (changedChats.length > 0) {
      aiAnalystOfflineChats.saveChats(changedChats).catch((error) => {
        console.error('[AIAnalystOfflineChats]: ', error);
      });
    }

    // Update current chat if it was deleted
    const currentChat = get(currentChatBaseAtom);
    if (deletedChatIds.includes(currentChat.id)) {
      set(currentChatBaseAtom, defaultChat);
    } else if (currentChat.id) {
      // Check if current chat was updated
      const updatedChat = newChats.find((chat) => chat.id === currentChat.id);
      if (updatedChat) {
        set(currentChatBaseAtom, updatedChat);
      }
    }

    set(chatsAtom, newChats);
    set(showChatHistoryAtom, newChats.length > 0 ? get(showChatHistoryAtom) : false);
    set(promptSuggestionsAtom, { abortController: undefined, suggestions: [] });
  }
);

// ============================================================================
// Loading atom with persistence on completion
// ============================================================================

export const loadingWithPersistenceAtom = atom(
  (get) => get(loadingAtom),
  (get, set, newLoading: boolean) => {
    const prevLoading = get(loadingAtom);

    // Save chat when loading completes
    if (prevLoading && !newLoading) {
      const currentChat = get(currentChatBaseAtom);
      if (currentChat.id) {
        aiAnalystOfflineChats.saveChats([currentChat]).catch((error) => {
          console.error('[AIAnalystOfflineChats]: ', error);
        });
      }
    }

    set(loadingAtom, newLoading);
  }
);

// ============================================================================
// Show AI Analyst atom with side effects
// ============================================================================

export const showAIAnalystWithEffectsAtom = atom(
  (get) => get(showAIAnalystAtom),
  (get, set, newValue: boolean) => {
    const wasShowing = get(showAIAnalystAtom);

    // Abort and focus grid when hiding
    if (wasShowing && !newValue) {
      const abortController = get(abortControllerAtom);
      abortController?.abort();
      focusGrid();
      set(activeSchemaConnectionUuidAtom, undefined);
    }

    set(showAIAnalystAtom, newValue);
  }
);

// ============================================================================
// Show chat history atom with side effects
// ============================================================================

export const showChatHistoryWithEffectsAtom = atom(
  (get) => get(showChatHistoryAtom),
  (get, set, newValue: boolean) => {
    const wasHidden = !get(showChatHistoryAtom);

    // Abort when showing chat history
    if (wasHidden && newValue) {
      const abortController = get(abortControllerAtom);
      abortController?.abort();
    }

    set(showChatHistoryAtom, newValue);
  }
);

// ============================================================================
// Initialization
// ============================================================================

let aiAnalystInitialized = false;

export function getAIAnalystInitialized(): boolean {
  return aiAnalystInitialized;
}

export async function initializeAIAnalyst(userEmail: string, fileUuid: string, showOnStartup: boolean): Promise<void> {
  const store = aiStore;

  // Set initial show state
  store.set(showAIAnalystAtom, showOnStartup);

  try {
    await aiAnalystOfflineChats.init(userEmail, fileUuid);
    const chats = await aiAnalystOfflineChats.loadChats();
    store.set(chatsAtom, chats);
  } catch (error) {
    console.error('[AIAnalystOfflineChats]: ', error);
  } finally {
    aiAnalystInitialized = true;
    events.emit('aiAnalystInitialized');
  }
}

// ============================================================================
// Vanilla JS Helper Functions (for use outside React)
// ============================================================================

/**
 * Get whether the AI Analyst is currently shown
 */
export function getShowAIAnalyst(): boolean {
  return aiStore.get(showAIAnalystAtom);
}

/**
 * Set whether the AI Analyst is shown (with side effects like abort/focus)
 */
export function setShowAIAnalyst(show: boolean): void {
  aiStore.set(showAIAnalystWithEffectsAtom, show);
}

/**
 * Toggle the AI Analyst visibility
 */
export function toggleShowAIAnalyst(): void {
  const current = aiStore.get(showAIAnalystAtom);
  aiStore.set(showAIAnalystWithEffectsAtom, !current);
}

// ============================================================================
// Combined atom for PixiAppSettings/PixiAppEffects compatibility
// ============================================================================

// Combined read-write atom that represents the full AIAnalystState
export const aiAnalystAtom = atom(
  (get): AIAnalystState => ({
    showAIAnalyst: get(showAIAnalystAtom),
    activeSchemaConnectionUuid: get(activeSchemaConnectionUuidAtom),
    showChatHistory: get(showChatHistoryAtom),
    abortController: get(abortControllerAtom),
    loading: get(loadingAtom),
    chats: get(chatsAtom),
    currentChat: get(currentChatAtom),
    promptSuggestions: get(promptSuggestionsAtom),
    pdfImport: get(pdfImportAtom),
    webSearch: get(webSearchAtom),
    importFilesToGrid: get(importFilesToGridAtom),
    waitingOnMessageIndex: get(waitingOnMessageIndexAtom),
    failingSqlConnections: get(failingSqlConnectionsAtom),
  }),
  (get, set, newState: AIAnalystState | ((prev: AIAnalystState) => AIAnalystState)) => {
    const prevState: AIAnalystState = {
      showAIAnalyst: get(showAIAnalystAtom),
      activeSchemaConnectionUuid: get(activeSchemaConnectionUuidAtom),
      showChatHistory: get(showChatHistoryAtom),
      abortController: get(abortControllerAtom),
      loading: get(loadingAtom),
      chats: get(chatsAtom),
      currentChat: get(currentChatAtom),
      promptSuggestions: get(promptSuggestionsAtom),
      pdfImport: get(pdfImportAtom),
      webSearch: get(webSearchAtom),
      importFilesToGrid: get(importFilesToGridAtom),
      waitingOnMessageIndex: get(waitingOnMessageIndexAtom),
      failingSqlConnections: get(failingSqlConnectionsAtom),
    };

    const state = typeof newState === 'function' ? newState(prevState) : newState;

    // Update individual atoms
    if (state.showAIAnalyst !== prevState.showAIAnalyst) {
      set(showAIAnalystWithEffectsAtom, state.showAIAnalyst);
    }
    if (state.activeSchemaConnectionUuid !== prevState.activeSchemaConnectionUuid) {
      set(activeSchemaConnectionUuidAtom, state.activeSchemaConnectionUuid);
    }
    if (state.showChatHistory !== prevState.showChatHistory) {
      set(showChatHistoryWithEffectsAtom, state.showChatHistory);
    }
    if (state.abortController !== prevState.abortController) {
      set(abortControllerAtom, state.abortController);
    }
    if (state.loading !== prevState.loading) {
      set(loadingWithPersistenceAtom, state.loading);
    }
    if (state.chats !== prevState.chats) {
      set(chatsWithPersistenceAtom, state.chats);
    }
    if (state.currentChat !== prevState.currentChat) {
      set(currentChatAtom, state.currentChat);
    }
    if (state.promptSuggestions !== prevState.promptSuggestions) {
      set(promptSuggestionsAtom, state.promptSuggestions);
    }
    if (state.pdfImport !== prevState.pdfImport) {
      set(pdfImportAtom, state.pdfImport);
    }
    if (state.webSearch !== prevState.webSearch) {
      set(webSearchAtom, state.webSearch);
    }
    if (state.importFilesToGrid !== prevState.importFilesToGrid) {
      set(importFilesToGridAtom, state.importFilesToGrid);
    }
    if (state.waitingOnMessageIndex !== prevState.waitingOnMessageIndex) {
      set(waitingOnMessageIndexAtom, state.waitingOnMessageIndex);
    }
    if (state.failingSqlConnections !== prevState.failingSqlConnections) {
      set(failingSqlConnectionsAtom, state.failingSqlConnections);
    }
  }
);
