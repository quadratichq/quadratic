/**
 * Effect Atoms - Atoms with side effects in their setters
 *
 * These atoms wrap primitive atoms with additional side effects.
 * They're used for React component integration where useSetAtom is preferred.
 *
 * For vanilla JS usage, prefer the action functions in actions.ts.
 */

import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import { focusGrid } from '@/app/helpers/focusGrid';
import { atom } from 'jotai';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
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
import { defaultChat } from './types';

// ============================================================================
// Show AI Analyst with side effects
// ============================================================================

/**
 * Atom for showing/hiding AI Analyst with cleanup side effects.
 * When hiding: aborts requests, focuses grid, clears schema connection.
 */
export const showAIAnalystWithEffectsAtom = atom(
  (get) => get(showAIAnalystAtom),
  (get, set, newValue: boolean) => {
    const wasShowing = get(showAIAnalystAtom);

    if (wasShowing && !newValue) {
      get(abortControllerAtom)?.abort();
      focusGrid();
      set(activeSchemaConnectionUuidAtom, undefined);
    }

    set(showAIAnalystAtom, newValue);
  }
);

// ============================================================================
// Show Chat History with side effects
// ============================================================================

/**
 * Atom for showing/hiding chat history with abort side effect.
 * When showing: aborts any pending request.
 */
export const showChatHistoryWithEffectsAtom = atom(
  (get) => get(showChatHistoryAtom),
  (get, set, newValue: boolean) => {
    const wasHidden = !get(showChatHistoryAtom);

    if (wasHidden && newValue) {
      get(abortControllerAtom)?.abort();
    }

    set(showChatHistoryAtom, newValue);
  }
);

// ============================================================================
// Chats with persistence
// ============================================================================

/**
 * Atom for managing chats with offline persistence.
 * Handles saving, deleting, and syncing chats with offline storage.
 */
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
    const changedChats = newChats.filter((chat) => {
      const prevChat = prevChats.find((p) => p.id === chat.id);
      if (!prevChat) return true;
      return prevChat.name !== chat.name || prevChat.lastUpdated !== chat.lastUpdated;
    });

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
// Loading with persistence
// ============================================================================

/**
 * Atom for loading state with chat persistence on completion.
 * When loading transitions from true to false: saves the current chat.
 */
export const loadingWithPersistenceAtom = atom(
  (get) => get(loadingAtom),
  (get, set, newLoading: boolean) => {
    const prevLoading = get(loadingAtom);

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
