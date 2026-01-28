import { atom } from 'jotai';
import type { Chat, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import { chatsAtom, currentChatBaseAtom, promptSuggestionsAtom, showChatHistoryAtom } from './primitives';
import { extractPromptSuggestionsFromChat } from './utils';

// ============================================================================
// Current Chat Atom
// Read: returns the current chat
// Write: updates the current chat and synchronizes with chats list
// ============================================================================

export const currentChatAtom = atom(
  (get) => get(currentChatBaseAtom),
  (get, set, newChat: Chat) => {
    // Abort any pending prompt suggestions
    get(promptSuggestionsAtom).abortController?.abort();

    // Update chats list if this chat has an id
    if (newChat.id) {
      const chats = get(chatsAtom);
      set(chatsAtom, [...chats.filter((chat) => chat.id !== newChat.id), newChat]);
    }

    // Extract prompt suggestions from the chat
    const suggestions = extractPromptSuggestionsFromChat(newChat);

    // Update state
    set(showChatHistoryAtom, false);
    set(currentChatBaseAtom, newChat);
    set(promptSuggestionsAtom, { abortController: undefined, suggestions });
  }
);

// ============================================================================
// Current Chat Name Atom
// Allows reading/writing just the chat name with persistence
// ============================================================================

export const currentChatNameAtom = atom(
  (get) => get(currentChatAtom).name,
  (get, set, newName: string) => {
    const currentChat = get(currentChatBaseAtom);

    const updatedChat: Chat = {
      ...currentChat,
      id: currentChat.id || v4(),
      name: newName,
    };

    // Update both atoms
    const chats = get(chatsAtom);
    set(chatsAtom, [...chats.filter((chat) => chat.id !== updatedChat.id), updatedChat]);
    set(currentChatBaseAtom, updatedChat);

    // Note: Persistence is handled by actions.ts
  }
);

// ============================================================================
// Current Chat Messages Atom
// Allows reading/writing messages with chat synchronization
// ============================================================================

export const currentChatMessagesAtom = atom(
  (get) => get(currentChatAtom).messages,
  (get, set, newMessages: ChatMessage[]) => {
    // Abort any pending prompt suggestions
    get(promptSuggestionsAtom).abortController?.abort();

    const currentChat = get(currentChatBaseAtom);

    const updatedChat: Chat = {
      id: currentChat.id || v4(),
      name: currentChat.name,
      lastUpdated: Date.now(),
      messages: newMessages,
    };

    // Update both atoms
    const chats = get(chatsAtom);
    set(chatsAtom, [...chats.filter((chat) => chat.id !== updatedChat.id), updatedChat]);
    set(currentChatBaseAtom, updatedChat);
    set(promptSuggestionsAtom, { abortController: undefined, suggestions: [] });
  }
);
