import { atom } from 'jotai';
import { isUserPromptMessage } from 'quadratic-shared/ai/helpers/message.helper';
import { currentChatAtom } from './chatAtoms';
import {
  chatsAtom,
  emptyChatSuggestionsAtom,
  importFilesToGridAtom,
  pdfImportAtom,
  promptSuggestionsAtom,
  webSearchAtom,
} from './primitives';

// ============================================================================
// Chat Count Selectors
// ============================================================================

/** Total number of saved chats */
export const chatsCountAtom = atom((get) => get(chatsAtom).length);

/** Number of messages in the current chat */
export const currentChatMessagesCountAtom = atom((get) => get(currentChatAtom).messages.length);

/** Number of user messages in the current chat */
export const currentChatUserMessagesCountAtom = atom(
  (get) => get(currentChatAtom).messages.filter((message) => isUserPromptMessage(message)).length
);

// ============================================================================
// Prompt Suggestions Selectors
// ============================================================================

/** Number of prompt suggestions available */
export const promptSuggestionsCountAtom = atom((get) => get(promptSuggestionsAtom).suggestions.length);

/** Whether prompt suggestions are currently being fetched */
export const promptSuggestionsLoadingAtom = atom((get) => get(promptSuggestionsAtom).abortController !== undefined);

// ============================================================================
// Feature Loading Selectors
// ============================================================================

/** Whether PDF import is in progress */
export const pdfImportLoadingAtom = atom((get) => get(pdfImportAtom).loading);

/** Whether web search is in progress */
export const webSearchLoadingAtom = atom((get) => get(webSearchAtom).loading);

/** Whether import files to grid is in progress */
export const importFilesToGridLoadingAtom = atom((get) => get(importFilesToGridAtom).loading);

// ============================================================================
// Empty Chat Suggestions Selectors
// ============================================================================

/** Whether empty chat suggestions are currently being fetched */
export const emptyChatSuggestionsLoadingAtom = atom((get) => get(emptyChatSuggestionsAtom).loading);
