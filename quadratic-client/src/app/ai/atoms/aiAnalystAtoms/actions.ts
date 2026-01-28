import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import { currentChatNameAtom } from './chatAtoms';
import {
  abortControllerAtom,
  activeSchemaConnectionUuidAtom,
  chatsAtom,
  currentChatBaseAtom,
  loadingAtom,
  promptSuggestionsAtom,
  showAIAnalystAtom,
  showChatHistoryAtom,
} from './primitives';
import { aiStore } from './store';
import { defaultChat } from './types';

// ============================================================================
// AI Analyst Visibility Actions
// ============================================================================

/**
 * Show or hide the AI Analyst panel.
 * Handles cleanup (abort, focus grid) when hiding.
 */
export function setShowAIAnalyst(show: boolean): void {
  const wasShowing = aiStore.get(showAIAnalystAtom);

  if (wasShowing && !show) {
    // Abort any pending request
    aiStore.get(abortControllerAtom)?.abort();
    // Focus back to grid
    focusGrid();
    // Clear schema connection
    aiStore.set(activeSchemaConnectionUuidAtom, undefined);
  }

  aiStore.set(showAIAnalystAtom, show);
}

/**
 * Toggle the AI Analyst visibility.
 */
export function toggleShowAIAnalyst(): void {
  setShowAIAnalyst(!aiStore.get(showAIAnalystAtom));
}

/**
 * Get whether the AI Analyst is currently shown.
 */
export function getShowAIAnalyst(): boolean {
  return aiStore.get(showAIAnalystAtom);
}

// ============================================================================
// Chat History Actions
// ============================================================================

/**
 * Show or hide the chat history view.
 * Aborts any pending request when showing history.
 */
export function setShowChatHistory(show: boolean): void {
  const wasHidden = !aiStore.get(showChatHistoryAtom);

  if (wasHidden && show) {
    // Abort any pending request when showing history
    aiStore.get(abortControllerAtom)?.abort();
  }

  aiStore.set(showChatHistoryAtom, show);
}

// ============================================================================
// Chat Persistence Actions
// ============================================================================

/**
 * Save a chat name with persistence.
 */
export async function saveChatName(newName: string): Promise<void> {
  aiStore.set(currentChatNameAtom, newName);

  const currentChat = aiStore.get(currentChatBaseAtom);
  if (currentChat.id) {
    try {
      await aiAnalystOfflineChats.saveChats([currentChat]);
    } catch (error) {
      console.error('[AIAnalystOfflineChats]: ', error);
    }
  }
}

/**
 * Update chats list with persistence.
 * Handles saving new/changed chats and deleting removed chats.
 */
export async function updateChatsWithPersistence(newChats: Chat[]): Promise<void> {
  const prevChats = aiStore.get(chatsAtom);
  const prevSuggestions = aiStore.get(promptSuggestionsAtom);
  prevSuggestions.abortController?.abort();

  // Find deleted chats
  const deletedChatIds = prevChats
    .filter((chat) => !newChats.some((newChat) => newChat.id === chat.id))
    .map((chat) => chat.id);

  // Delete from offline storage
  if (deletedChatIds.length > 0) {
    try {
      await aiAnalystOfflineChats.deleteChats(deletedChatIds);
    } catch (error) {
      console.error('[AIAnalystOfflineChats]: ', error);
    }
  }

  // Find changed chats
  const changedChats = newChats.filter((chat) => {
    const prevChat = prevChats.find((p) => p.id === chat.id);
    if (!prevChat) return true;
    return prevChat.name !== chat.name || prevChat.lastUpdated !== chat.lastUpdated;
  });

  // Save changed chats
  if (changedChats.length > 0) {
    try {
      await aiAnalystOfflineChats.saveChats(changedChats);
    } catch (error) {
      console.error('[AIAnalystOfflineChats]: ', error);
    }
  }

  // Update current chat if it was deleted
  const currentChat = aiStore.get(currentChatBaseAtom);
  if (deletedChatIds.includes(currentChat.id)) {
    aiStore.set(currentChatBaseAtom, defaultChat);
  } else if (currentChat.id) {
    // Check if current chat was updated
    const updatedChat = newChats.find((chat) => chat.id === currentChat.id);
    if (updatedChat) {
      aiStore.set(currentChatBaseAtom, updatedChat);
    }
  }

  aiStore.set(chatsAtom, newChats);
  aiStore.set(showChatHistoryAtom, newChats.length > 0 ? aiStore.get(showChatHistoryAtom) : false);
  aiStore.set(promptSuggestionsAtom, { abortController: undefined, suggestions: [] });
}

/**
 * Set loading state with persistence on completion.
 * When loading transitions from true to false, saves the current chat.
 */
export async function setLoadingWithPersistence(newLoading: boolean): Promise<void> {
  const prevLoading = aiStore.get(loadingAtom);

  // Save chat when loading completes
  if (prevLoading && !newLoading) {
    const currentChat = aiStore.get(currentChatBaseAtom);
    if (currentChat.id) {
      try {
        await aiAnalystOfflineChats.saveChats([currentChat]);
      } catch (error) {
        console.error('[AIAnalystOfflineChats]: ', error);
      }
    }
  }

  aiStore.set(loadingAtom, newLoading);
}

// ============================================================================
// Initialization
// ============================================================================

let aiAnalystInitialized = false;

/**
 * Check if the AI Analyst has been initialized.
 */
export function getAIAnalystInitialized(): boolean {
  return aiAnalystInitialized;
}

/**
 * Initialize the AI Analyst with user and file context.
 * Loads saved chats from offline storage.
 */
export async function initializeAIAnalyst(userEmail: string, fileUuid: string, showOnStartup: boolean): Promise<void> {
  aiStore.set(showAIAnalystAtom, showOnStartup);

  try {
    await aiAnalystOfflineChats.init(userEmail, fileUuid);
    const chats = await aiAnalystOfflineChats.loadChats();
    aiStore.set(chatsAtom, chats);
  } catch (error) {
    console.error('[AIAnalystOfflineChats]: ', error);
  } finally {
    aiAnalystInitialized = true;
    events.emit('aiAnalystInitialized');
  }
}
