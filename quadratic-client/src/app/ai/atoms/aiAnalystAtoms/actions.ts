import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import { events } from '@/app/events/events';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import { currentChatNameAtom } from './chatAtoms';
import {
  chatsWithPersistenceAtom,
  loadingWithPersistenceAtom,
  showAIAnalystWithEffectsAtom,
  showChatHistoryWithEffectsAtom,
} from './effectAtoms';
import { aiAnalystInitializedAtom, chatsAtom, currentChatBaseAtom, showAIAnalystAtom } from './primitives';
import { aiStore } from './store';

// ============================================================================
// AI Analyst Visibility Actions
// ============================================================================

/**
 * Show or hide the AI Analyst panel.
 * Handles cleanup (abort, focus grid) when hiding.
 *
 * Delegates to showAIAnalystWithEffectsAtom for the actual logic.
 */
export function setShowAIAnalyst(show: boolean): void {
  aiStore.set(showAIAnalystWithEffectsAtom, show);
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
 *
 * Delegates to showChatHistoryWithEffectsAtom for the actual logic.
 */
export function setShowChatHistory(show: boolean): void {
  aiStore.set(showChatHistoryWithEffectsAtom, show);
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
 *
 * Delegates to chatsWithPersistenceAtom for the actual logic.
 * Note: The effect atom handles persistence asynchronously with .catch(),
 * so this function no longer needs to be async.
 */
export function updateChatsWithPersistence(newChats: Chat[]): void {
  aiStore.set(chatsWithPersistenceAtom, newChats);
}

/**
 * Set loading state with persistence on completion.
 * When loading transitions from true to false, saves the current chat.
 *
 * Delegates to loadingWithPersistenceAtom for the actual logic.
 * Note: The effect atom handles persistence asynchronously with .catch(),
 * so this function no longer needs to be async.
 */
export function setLoadingWithPersistence(newLoading: boolean): void {
  aiStore.set(loadingWithPersistenceAtom, newLoading);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Check if the AI Analyst has been initialized.
 */
export function getAIAnalystInitialized(): boolean {
  return aiStore.get(aiAnalystInitializedAtom);
}

/**
 * Reset the AI Analyst initialization state.
 * Useful when switching files or logging out.
 */
export function resetAIAnalystInitialized(): void {
  aiStore.set(aiAnalystInitializedAtom, false);
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
    aiStore.set(aiAnalystInitializedAtom, true);
    events.emit('aiAnalystInitialized');
  }
}
